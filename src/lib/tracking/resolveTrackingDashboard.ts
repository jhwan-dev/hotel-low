import "server-only";

import { hotelProvider } from "@/lib/hotels";
import { computePriceStatus, type PriceStatus } from "@/lib/hotels/price-history";
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
 * Like resolveTrackedResults, but also pulls 30-day price history so the "내
 * 호텔" dashboard can show a previous price, change %, and price status per
 * card. That's an extra fetch per tracked hotel, so kept separate from the
 * lighter resolveTrackedResults the home page uses.
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
        }),
        hotelProvider.getPriceHistory(settings.hotelId, settings.checkIn, settings.checkOut, 30),
      ]);
      if (!result) return null;

      const points = history?.points ?? [];
      const previousPoint = points.length >= 2 ? points[points.length - 2] : null;
      const previousTotalPrice = previousPoint ? previousPoint.price * result.price.nights : null;
      const changePercent = previousPoint
        ? Math.round(
            ((result.price.nightlyPrice - previousPoint.price) / previousPoint.price) * 100,
          )
        : null;
      const status =
        points.length > 0
          ? computePriceStatus(result.price.nightlyPrice, points, result.price.currency)
          : null;
      const lastCheckedAt = points.length > 0 ? points[points.length - 1].checkedAt : null;

      return { settings, result, previousTotalPrice, changePercent, status, lastCheckedAt };
    }),
  );
  return resolved.filter((r): r is TrackedDashboardItem => r !== null);
}
