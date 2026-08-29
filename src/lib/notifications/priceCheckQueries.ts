import "server-only";

import { hotelCatalog } from "@/lib/hotels";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHotelProviderRef } from "@/lib/supabase/hotelsTable";
import type { Currency } from "@/types/hotel";

export interface TrackedHotelForCheck {
  /** tracked_hotels.id — the FK price_alerts.tracked_hotel_id points at. */
  trackedHotelId: string;
  userId: string;
  /** App catalog id (what hotelProvider.getHotelById expects), not the Supabase hotels.id. */
  hotelId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  targetPrice: number;
  currency: Currency;
  notifyOnAnyDrop: boolean;
  notifyOnNewLow: boolean;
}

/**
 * Every active tracked_hotels row, across every user — only the system
 * price-check job needs this. Unlike everything in
 * src/lib/tracking/supabaseRepository.ts, this deliberately bypasses RLS via
 * the admin client, because a scheduled job has no signed-in user to scope
 * by. Never call this from a user-facing request.
 */
export async function listAllActiveTrackedHotels(): Promise<TrackedHotelForCheck[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tracked_hotels")
    .select(
      "id, user_id, hotel_id, check_in, check_out, adults, children, rooms, target_price, currency, notify_on_any_drop, notify_on_new_low",
    )
    .eq("is_active", true);
  if (error) throw error;
  if (!data) return [];

  const results: TrackedHotelForCheck[] = [];
  for (const row of data) {
    const ref = await getHotelProviderRef(admin, row.hotel_id);
    if (!ref || ref.provider !== "agoda") continue;
    const entry = hotelCatalog.findByAgodaHotelId(Number(ref.providerHotelId));
    if (!entry) continue;

    results.push({
      trackedHotelId: row.id,
      userId: row.user_id,
      hotelId: entry.appHotelId,
      checkIn: row.check_in,
      checkOut: row.check_out,
      adults: row.adults,
      children: row.children,
      rooms: row.rooms,
      targetPrice: Number(row.target_price),
      currency: row.currency as Currency,
      notifyOnAnyDrop: row.notify_on_any_drop,
      notifyOnNewLow: row.notify_on_new_low,
    });
  }
  return results;
}
