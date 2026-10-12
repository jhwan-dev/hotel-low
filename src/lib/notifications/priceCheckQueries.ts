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
 * Deactivates every active tracked_hotels row whose stay has already
 * started as of `beforeDateISO` (the check-in date itself counts as
 * started — `lt`, not `lte`, since a stay checking in today is still
 * current). Called once at the top of checkPriceAlerts(), before listing,
 * so a stale tracking is both turned off *and* excluded from this run —
 * same admin-client/RLS-bypass reasoning as listAllActiveTrackedHotels.
 * Returns how many rows it turned off, for logging.
 */
export async function deactivateExpiredTrackedHotels(beforeDateISO: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tracked_hotels")
    .update({ is_active: false })
    .lt("check_in", beforeDateISO)
    .eq("is_active", true)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
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
    const entry = await hotelCatalog.findByProviderHotelId(ref.providerHotelId);
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
