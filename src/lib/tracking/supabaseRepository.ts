import "server-only";

import { nightsBetween, seoulDayRangeUTC, todayISO, todayISOInSeoul } from "@/lib/date";
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
  resolveProvisionalName,
  updateAgodaPriceStatus,
} from "@/lib/supabase/hotelsTable";
import type { Currency, PartySize, PriceProvider, RoomPrice } from "@/types/hotel";
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
  target_price: number | string | null;
  notify_on_any_drop: boolean;
  notify_on_new_low: boolean;
  status: string;
  created_at: string;
}

const TRACKED_HOTEL_COLUMNS =
  "check_in, check_out, adults, children, rooms, currency, target_price, notify_on_any_drop, notify_on_new_low, status, created_at";

function toSettings(row: TrackedHotelRow, hotelId: string): PriceTrackingSettings {
  return {
    hotelId,
    checkIn: row.check_in,
    checkOut: row.check_out,
    adults: row.adults,
    children: row.children,
    rooms: row.rooms,
    currency: row.currency as Currency,
    targetPrice: row.target_price === null ? null : Number(row.target_price),
    notifyOnAnyDrop: row.notify_on_any_drop,
    notifyOnNewLow: row.notify_on_new_low,
    status: row.status as "pending" | "active",
    trackingStartedAt: row.created_at,
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

  /**
   * A price for this exact (hotel, stay, party) already recorded today
   * (Asia/Seoul calendar day) — e.g. the price-check cron already ran, or
   * another user started tracking the same stay earlier today. Finding one
   * means tracking-start can skip SerpApi entirely. Deliberately narrower
   * than PriceHistoryRepository.getLatestPrice: that reads the single most
   * recent row regardless of age, which could be from any day and would
   * silently reuse a stale quote instead of making a fresh (or pending)
   * check.
   */
  private async findTodaysCachedPrice(
    hotelRowId: string,
    checkIn: string,
    checkOut: string,
    partySize: PartySize,
  ): Promise<{
    nightlyPrice: number;
    currency: Currency;
    provider: PriceProvider;
    bookingUrl: string | null;
  } | null> {
    const { startUTC, endUTC } = seoulDayRangeUTC();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hotel_price_history")
      .select("price, currency, provider, booking_url")
      .eq("hotel_id", hotelRowId)
      .eq("check_in", checkIn)
      .eq("check_out", checkOut)
      .eq("adults", partySize.adults)
      .eq("children", partySize.children)
      .eq("rooms", partySize.rooms)
      .gte("checked_at", startUTC)
      .lt("checked_at", endUTC)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      nightlyPrice: Number(data.price),
      currency: data.currency as Currency,
      provider: data.provider as PriceProvider,
      bookingUrl: data.booking_url,
    };
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

  /**
   * SerpApi's daily call budget is exhausted — register the tracking
   * anyway instead of rejecting it (TrackingRejectedError used to be thrown
   * here). target_price is kept as-is if the user already set one, left
   * NULL otherwise; the price-check cron fills in a price (and a default
   * target, if still unset) on its next run — see checkPriceAlerts.ts.
   */
  private async insertPending(
    userId: string,
    hotelRowId: string,
    input: TrackingInput,
  ): Promise<TrackingUpsertResult> {
    if (input.targetPrice !== undefined && input.targetPrice <= 0) {
      throw new TrackingRejectedError("목표 가격은 0보다 커야 해요");
    }

    const supabase = await createClient();
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
      target_price: input.targetPrice ?? null,
      currency: input.currency,
      notify_on_any_drop: input.notifyOnAnyDrop,
      notify_on_new_low: input.notifyOnNewLow,
      is_active: true,
      status: "pending",
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

    return { settings: toSettings(data, input.hotelId), price: null };
  }

  /**
   * A settings edit (notify toggles / target price) on a tracking that
   * already exists — never worth a fresh SerpApi call: the target is
   * validated against whatever's already stored (hotel_price_history's
   * latest row for this exact stay), not a new live check. Only reachable
   * for an "active" existing row — a "pending" one is routed to
   * insertPending instead, which already has the right update-in-place
   * behavior for that case (no price to validate against yet).
   */
  private async updateActiveSettings(
    trackedHotelId: string,
    input: TrackingInput,
  ): Promise<TrackingUpsertResult> {
    const partySize: PartySize = { adults: input.adults, children: input.children, rooms: input.rooms };
    const latest = await priceHistoryRepository.getLatestPrice(
      input.hotelId,
      input.checkIn,
      input.checkOut,
      partySize,
    );
    // Invariant: an "active" row always has at least one hotel_price_history
    // row for its exact stay (see SupabasePriceHistoryRepository's own
    // comment) — null here means that invariant broke, not a case to
    // silently work around with a fresh SerpApi call mid-settings-edit.
    if (!latest) {
      throw new TrackingRejectedError("현재 가격을 확인할 수 없어요. 잠시 후 다시 시도해주세요.");
    }

    const nights = nightsBetween(input.checkIn, input.checkOut);
    const totalPrice = latest.nightlyPrice * nights * input.rooms;

    const targetPrice = input.targetPrice ?? defaultTargetPrice(totalPrice);
    if (targetPrice <= 0 || targetPrice >= totalPrice) {
      throw new TrackingRejectedError("목표 가격은 현재 가격보다 낮아야 해요");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tracked_hotels")
      .update({
        target_price: targetPrice,
        notify_on_any_drop: input.notifyOnAnyDrop,
        notify_on_new_low: input.notifyOnNewLow,
      })
      .eq("id", trackedHotelId)
      .select(`id, ${TRACKED_HOTEL_COLUMNS}`)
      .single();
    if (error) throw error;

    const livePrice: RoomPrice = {
      hotelId: input.hotelId,
      provider: latest.provider,
      currency: latest.currency,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights,
      nightlyPrice: latest.nightlyPrice,
      totalPrice,
      checkedAt: latest.checkedAt,
    };

    return { settings: toSettings(data, input.hotelId), price: livePrice };
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

    const supabase = await createClient();
    const { data: existingRow, error: existingError } = await supabase
      .from("tracked_hotels")
      .select("id, status")
      .eq("user_id", userId)
      .eq("hotel_id", hotelRowId)
      .eq("check_in", input.checkIn)
      .eq("check_out", input.checkOut)
      .eq("is_active", true)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingRow) {
      if (existingRow.status === "pending") {
        // insertPending's own existing-row branch already updates a
        // pending row in place with the right rule (keep the user's own
        // target if set, otherwise leave it null) — reuse it rather than
        // duplicating that rule here.
        return this.insertPending(userId, hotelRowId, input);
      }
      return this.updateActiveSettings(existingRow.id, input);
    }

    const partySize: PartySize = { adults: input.adults, children: input.children, rooms: input.rooms };
    const cached = await this.findTodaysCachedPrice(hotelRowId, input.checkIn, input.checkOut, partySize);

    let livePrice: RoomPrice;
    if (cached) {
      // Already checked today for this exact (hotel, stay, party) — reuse
      // it instead of spending another SerpApi call. backfillHotelDetails/
      // resolveProvisionalName only make sense right after a fresh live
      // detail fetch, so skip those too; recordPrice below is skipped the
      // same way (duplicating today's own row would gain nothing).
      const nights = nightsBetween(input.checkIn, input.checkOut);
      livePrice = {
        hotelId: input.hotelId,
        provider: cached.provider,
        currency: cached.currency,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        nights,
        nightlyPrice: cached.nightlyPrice,
        totalPrice: cached.nightlyPrice * nights * input.rooms,
        checkedAt: todayISOInSeoul(),
        deepLink: cached.bookingUrl ?? undefined,
      };
    } else {
      // Only spend from the shared daily budget when SerpApi is actually
      // the live price source — under the mock/Agoda fallback,
      // fetchLivePrice() below costs nothing real, so there's nothing to
      // rate-limit.
      if (isSerpApiConfigured()) {
        const allowed = await tryConsumeDailyCall(getSerpApiDailyLimit());
        if (!allowed) return this.insertPending(userId, hotelRowId, input);
      }

      const fetched = await hotelProvider.fetchLivePrice(input.hotelId, {
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
        fetched ? "available" : "unavailable",
        todayISO(),
      );

      if (!fetched) {
        throw new TrackingRejectedError("이 숙소는 현재 아고다 가격을 확인할 수 없어요");
      }
      livePrice = fetched;

      // Opportunistic, zero-extra-call catalog backfill from the detail
      // response this fetchLivePrice call already made — never overwrites a
      // value that's already there (including the ones filled in by hand).
      await backfillHotelDetails(admin, hotelRowId, {
        address: livePrice.detailAddress ?? null,
        agodaHid: livePrice.detailAgodaHid ?? null,
      });
      // No-op unless this row was inserted by the Agoda-link-import flow
      // with a provisional (hl=en) name — see resolveProvisionalName.
      await resolveProvisionalName(admin, hotelRowId, livePrice.detailName ?? null);

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
    }

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

    // A brand-new tracking — existingRow was already confirmed absent at
    // the top of this method, so this is always an insert, never an update.
    const { data, error } = await supabase
      .from("tracked_hotels")
      .insert({
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
        status: "active",
      })
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
