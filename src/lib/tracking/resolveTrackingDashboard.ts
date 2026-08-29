import "server-only";

import { hotelProvider } from "@/lib/hotels";
import { computePriceStatus, toTotalPoints, type PriceStatus } from "@/lib/hotels/price-history";
import type { HotelSearchResult } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";

export interface TrackedDashboardItem {
  settings: PriceTrackingSettings;
  result: HotelSearchResult;
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

      const points = history?.points ?? [];
      const totalPoints = toTotalPoints(points, result.price.nights, settings.rooms);
      const previousPoint = totalPoints.length >= 2 ? totalPoints[totalPoints.length - 2] : null;
      const previousTotalPrice = previousPoint ? previousPoint.price : null;
      const changePercent = previousTotalPrice
        ? Math.round(((result.price.totalPrice - previousTotalPrice) / previousTotalPrice) * 100)
        : null;
      const status =
        totalPoints.length > 0
          ? computePriceStatus(
              result.price.totalPrice,
              previousTotalPrice,
              totalPoints,
              result.price.currency,
            )
          : null;
      const lastCheckedAt = points.length > 0 ? points[points.length - 1].checkedAt : null;

      return { settings, result, previousTotalPrice, changePercent, status, lastCheckedAt };
    }),
  );
  return resolved.filter((r): r is TrackedDashboardItem => r !== null);
}
