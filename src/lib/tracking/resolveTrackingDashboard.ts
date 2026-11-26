import "server-only";

import { hotelProvider } from "@/lib/hotels";
import { computePriceStatus, toTotalPoints, type PriceStatus } from "@/lib/hotels/price-history";
import type { Hotel, RoomPrice } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";

export interface TrackedDashboardItem {
  settings: PriceTrackingSettings;
  hotel: Hotel;
  /** Null exactly when settings.status === "pending" — SerpApi's daily budget was exhausted at creation time, so there's no hotel_price_history row yet (see SupabaseTrackedHotelsRepository.upsert's insertPending). Every "active" row has one by construction. */
  price: RoomPrice | null;
  /** Total stay price the day before the most recent check, or null if there's no earlier point yet. */
  previousTotalPrice: number | null;
  /** Nightly price change vs. previousTotalPrice's nightly rate, rounded to a whole percent. */
  changePercent: number | null;
  status: PriceStatus | null;
  lastCheckedAt: string | null;
}

/**
 * Resolves each tracked stay's current listing plus 30-day price history, so
 * both the home screen and /tracking can show a previous price, change %,
 * and price status per card.
 */
export async function resolveTrackingDashboard(
  list: PriceTrackingSettings[],
): Promise<TrackedDashboardItem[]> {
  const resolved = await Promise.all(
    list.map(async (settings): Promise<TrackedDashboardItem | null> => {
      const [result, history] = await Promise.all([
        hotelProvider.getHotelById(settings.hotelId, {
          destination: "",
          checkIn: settings.checkIn,
          checkOut: settings.checkOut,
          adults: settings.adults,
          children: settings.children,
          rooms: settings.rooms,
        }),
        hotelProvider.getPriceHistory(settings.hotelId, settings.checkIn, settings.checkOut, 30),
      ]);
      if (!result) return null;
      const price = result.price;
      // Pending (no price confirmed yet) — show the card with everything
      // else null rather than dropping it, so the user still sees it's
      // tracking, just waiting on its first check.
      if (!price) {
        return {
          settings,
          hotel: result.hotel,
          price: null,
          previousTotalPrice: null,
          changePercent: null,
          status: null,
          lastCheckedAt: null,
        };
      }

      const points = history?.points ?? [];
      const totalPoints = toTotalPoints(points, price.nights, settings.rooms);
      const previousPoint = totalPoints.length >= 2 ? totalPoints[totalPoints.length - 2] : null;
      const previousTotalPrice = previousPoint ? previousPoint.price : null;
      const changePercent = previousTotalPrice
        ? Math.round(((price.totalPrice - previousTotalPrice) / previousTotalPrice) * 100)
        : null;
      const status =
        totalPoints.length > 0
          ? computePriceStatus(price.totalPrice, previousTotalPrice, totalPoints, price.currency)
          : null;
      const lastCheckedAt = points.length > 0 ? points[points.length - 1].checkedAt : null;

      return { settings, hotel: result.hotel, price, previousTotalPrice, changePercent, status, lastCheckedAt };
    }),
  );
  return resolved.filter((r): r is TrackedDashboardItem => r !== null);
}
