import "server-only";

import type { HotelCatalog } from "@/lib/hotels/catalog";
import { hotelProvider } from "@/lib/hotels";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureHotelRow, findHotelRowId, getHotelProviderRef } from "@/lib/supabase/hotelsTable";
import type { Currency } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";
import type { TrackedHotelsRepository, TrackingInput } from "./repository";

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
  constructor(private readonly catalog: HotelCatalog) {}

  private async resolveHotelRowId(hotelId: string): Promise<string | null> {
    const entry = this.catalog.findByAppHotelId(hotelId);
    if (!entry) return null;
    const supabase = await createClient();
    return findHotelRowId(supabase, "agoda", entry.agodaHotelId);
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
      const entry = this.catalog.findByAgodaHotelId(Number(ref.providerHotelId));
      if (!entry) continue;
      results.push(toSettings(row, entry.appHotelId));
    }
    return results;
  }

  async upsert(userId: string, input: TrackingInput): Promise<PriceTrackingSettings> {
    const entry = this.catalog.findByAppHotelId(input.hotelId);
    if (!entry) throw new Error(`Unknown hotel: ${input.hotelId}`);

    const result = await hotelProvider.getHotelById(input.hotelId, {
      destination: "",
      checkIn: input.checkIn,
      checkOut: input.checkOut,
    });
    if (!result) throw new Error(`Unknown hotel: ${input.hotelId}`);

    const admin = createAdminClient();
    const hotelRowId = await ensureHotelRow(admin, {
      provider: "agoda",
      providerHotelId: entry.agodaHotelId,
      name: result.hotel.name,
      city: result.hotel.location.city,
      country: result.hotel.location.country,
      address: result.hotel.location.address,
      rating: result.hotel.rating,
      reviewCount: result.hotel.reviewCount,
      images: result.hotel.images,
      amenities: result.hotel.amenities,
    });

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
      target_price: input.targetPrice,
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

    return toSettings(data, input.hotelId);
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
