import "server-only";

import { todayISO } from "@/lib/date";
import type { HotelCatalog } from "@/lib/hotels/catalog";
import { hotelProvider, priceHistoryRepository } from "@/lib/hotels";
import { getSerpApiDailyLimit, isSerpApiConfigured } from "@/lib/hotels/serpapi/env";
import { SupabaseHotelCatalog } from "@/lib/hotels/supabaseCatalog";
import { tryConsumeDailyCall } from "@/lib/serpapi/callBudget";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  backfillHotelDetails,
  ensureHotelRow,
  findHotelRowId,
  getHotelProviderRef,
  updateAgodaPriceStatus,
} from "@/lib/supabase/hotelsTable";
import type { Currency } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";
import { defaultTargetPrice } from "./targetPrice";
import {
  TrackingRejectedError,
  type TrackedHotelsRepository,
  type TrackingInput,
  type TrackingUpsertResult,
} from "./repository";

interface TrackedHotelRow {
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rooms: number;
  currency: string;
  target_price: number | string;
  notify_on_any_drop: boolean;
  notify_on_new_low: boolean;
}

const TRACKED_HOTEL_COLUMNS =
  "check_in, check_out, adults, children, rooms, currency, target_price, notify_on_any_drop, notify_on_new_low";

function toSettings(row: TrackedHotelRow, hotelId: string): PriceTrackingSettings {
  return {
    hotelId,
    checkIn: row.check_in,
    checkOut: row.check_out,
    adults: row.adults,
    children: row.children,
    rooms: row.rooms,
    currency: row.currency as Currency,
    targetPrice: Number(row.target_price),
    notifyOnAnyDrop: row.notify_on_any_drop,
    notifyOnNewLow: row.notify_on_new_low,
  };
}

/**
 * Real tracked_hotels CRUD, scoped by RLS to the signed-in user. Reads/writes
 * against tracked_hotels go through the session client (createClient) so
 * `auth.uid() = user_id` is enforced by Postgres, not application code. The
 * one exception is ensureHotelRow: RLS deliberately blocks anon/authenticated
 * writes to the shared `hotels` catalog, so that one step uses the admin
 * client — see src/lib/supabase/hotelsTable.ts for why that's safe.
 */
export class SupabaseTrackedHotelsRepository implements TrackedHotelsRepository {
  private readonly isSupabaseCatalog: boolean;

  constructor(private readonly catalog: HotelCatalog) {
    this.isSupabaseCatalog = catalog instanceof SupabaseHotelCatalog;
  }

  /** See the identical optimization + comment in src/lib/hotels/price-history-repository.ts's resolveHotelRowId — same reasoning, same two wasted round-trips this skips whenever the catalog is Supabase-backed. */
  private async resolveHotelRowId(hotelId: string): Promise<string | null> {
    if (this.isSupabaseCatalog) return hotelId;
    const entry = await this.catalog.findByAppHotelId(hotelId);
    if (!entry) return null;
    const supabase = await createClient();
    return findHotelRowId(supabase, "agoda", entry.providerHotelId);
  }

  async findActive(
    userId: string,
    hotelId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<PriceTrackingSettings | null> {
    const hotelRowId = await this.resolveHotelRowId(hotelId);
    if (!hotelRowId) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tracked_hotels")
      .select(`id, ${TRACKED_HOTEL_COLUMNS}`)
      .eq("user_id", userId)
      .eq("hotel_id", hotelRowId)
      .eq("check_in", checkIn)
      .eq("check_out", checkOut)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return data ? toSettings(data, hotelId) : null;
  }

  async listActive(userId: string): Promise<PriceTrackingSettings[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tracked_hotels")
      .select(`hotel_id, ${TRACKED_HOTEL_COLUMNS}`)
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data) return [];

    const results: PriceTrackingSettings[] = [];
    for (const row of data) {
      const ref = await getHotelProviderRef(supabase, row.hotel_id);
      if (!ref || ref.provider !== "agoda") continue;
      const entry = await this.catalog.findByProviderHotelId(ref.providerHotelId);
      if (!entry) continue;
      results.push(toSettings(row, entry.appHotelId));
    }
    return results;
  }

  async upsert(userId: string, input: TrackingInput): Promise<TrackingUpsertResult> {
    const entry = await this.catalog.findByAppHotelId(input.hotelId);
    if (!entry) throw new Error(`Unknown hotel: ${input.hotelId}`);

    const admin = createAdminClient();
    // Syncs the catalog's current display data into `hotels` — a no-op
    // write when this.catalog is already SupabaseHotelCatalog (same row,
    // same data), but still needed when it's MockHotelCatalog (Supabase
    // configured, SERPAPI_API_KEY isn't) since nothing else writes that row.
    const hotelRowId = await ensureHotelRow(admin, {
      provider: "agoda",
      providerHotelId: entry.providerHotelId,
      name: entry.name,
      city: entry.city,
      country: entry.country,
      address: entry.address,
      rating: entry.rating,
      reviewCount: entry.reviewCount,
      images: entry.images,
      amenities: entry.amenities,
    });

    // Only spend from the shared daily budget when SerpApi is actually the
    // live price source — under the mock/Agoda fallback, fetchLivePrice()
    // below costs nothing real, so there's nothing to rate-limit.
    if (isSerpApiConfigured()) {
      const allowed = await tryConsumeDailyCall(getSerpApiDailyLimit());
      if (!allowed) throw new TrackingRejectedError("잠시 후 다시 시도해주세요");
    }

    const livePrice = await hotelProvider.fetchLivePrice(input.hotelId, {
      destination: "",
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      rooms: input.rooms,
    });

    await updateAgodaPriceStatus(
      admin,
      hotelRowId,
      livePrice ? "available" : "unavailable",
      todayISO(),
    );

    if (!livePrice) {
      throw new TrackingRejectedError("이 숙소는 현재 아고다 가격을 확인할 수 없어요");
    }

    // Opportunistic, zero-extra-call catalog backfill from the detail
    // response this fetchLivePrice call already made — never overwrites a
    // value that's already there (including the ones filled in by hand).
    await backfillHotelDetails(admin, hotelRowId, {
      address: livePrice.detailAddress ?? null,
      agodaHid: livePrice.detailAgodaHid ?? null,
    });

    await priceHistoryRepository.recordPrice({
      hotelId: input.hotelId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      rooms: input.rooms,
      price: livePrice.nightlyPrice,
      currency: livePrice.currency,
      provider: livePrice.provider,
      bookingUrl: livePrice.deepLink,
    });

    // input.targetPrice is omitted when the client didn't know the price
    // yet at submit time (PriceTrackingSheet's priceUnknown mode) — now
    // that this live check has confirmed one, pick the same default the
    // sheet would have shown if it had known. Either way, re-validate
    // server-side: the client's own check (targetPrice < currentPrice) is
    // just UI guidance, not something this write should ever trust blindly.
    const targetPrice = input.targetPrice ?? defaultTargetPrice(livePrice.totalPrice);
    if (targetPrice <= 0 || targetPrice >= livePrice.totalPrice) {
      throw new TrackingRejectedError("목표 가격은 현재 가격보다 낮아야 해요");
    }

    const supabase = await createClient();

    // No ON CONFLICT here on purpose: the unique index on
    // (user_id, hotel_id, check_in, check_out) is partial (`where is_active`),
    // and PostgREST's upsert can't target a partial index. Find-then-branch
    // works with that constraint instead of fighting it.
    const { data: existing, error: findError } = await supabase
      .from("tracked_hotels")
      .select("id")
      .eq("user_id", userId)
      .eq("hotel_id", hotelRowId)
      .eq("check_in", input.checkIn)
      .eq("check_out", input.checkOut)
      .eq("is_active", true)
      .maybeSingle();
    if (findError) throw findError;

    const payload = {
      user_id: userId,
      hotel_id: hotelRowId,
      check_in: input.checkIn,
      check_out: input.checkOut,
      adults: input.adults,
      children: input.children,
      rooms: input.rooms,
      target_price: targetPrice,
      currency: input.currency,
      notify_on_any_drop: input.notifyOnAnyDrop,
      notify_on_new_low: input.notifyOnNewLow,
      is_active: true,
    };

    const { data, error } = existing
      ? await supabase
          .from("tracked_hotels")
          .update(payload)
          .eq("id", existing.id)
          .select(`id, ${TRACKED_HOTEL_COLUMNS}`)
          .single()
      : await supabase
          .from("tracked_hotels")
          .insert(payload)
          .select(`id, ${TRACKED_HOTEL_COLUMNS}`)
          .single();
    if (error) throw error;

    return { settings: toSettings(data, input.hotelId), price: livePrice };
  }

  async deactivate(
    userId: string,
    hotelId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<void> {
    const hotelRowId = await this.resolveHotelRowId(hotelId);
    if (!hotelRowId) return;

    const supabase = await createClient();
    const { error } = await supabase
      .from("tracked_hotels")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("hotel_id", hotelRowId)
      .eq("check_in", checkIn)
      .eq("check_out", checkOut);
    if (error) throw error;
  }
}
