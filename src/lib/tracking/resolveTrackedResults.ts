import "server-only";

import { hotelProvider } from "@/lib/hotels";
import type { HotelSearchResult } from "@/types/hotel";
import type { PriceTrackingSettings } from "@/types/tracking";

export interface TrackedResult {
  settings: PriceTrackingSettings;
  result: HotelSearchResult;
}

/** Fills in current hotel/price info for each tracked entry — used by the home screen's "추적 중인 호텔" section and /tracking. */
export async function resolveTrackedResults(
  list: PriceTrackingSettings[],
): Promise<TrackedResult[]> {
  const resolved = await Promise.all(
    list.map(async (settings): Promise<TrackedResult | null> => {
      const result = await hotelProvider.getHotelById(settings.hotelId, {
        destination: "",
        checkIn: settings.checkIn,
        checkOut: settings.checkOut,
      });
      return result ? { settings, result } : null;
    }),
  );
  return resolved.filter((r): r is TrackedResult => r !== null);
}
