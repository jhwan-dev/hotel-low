import { hotelCatalog, hotelProvider } from "@/lib/hotels";
import { addDaysISO, todayISO } from "@/lib/date";
import type { HotelSearchResult } from "@/types/hotel";

export interface LowAvailabilityDeal {
  result: HotelSearchResult;
  remainingRooms: number;
}

const LOW_AVAILABILITY_THRESHOLD = 5;

/**
 * Home-page curation: hotels with only a few rooms left at this rate, fewest
 * first. Same placeholder stay as getRecentPriceDrops() — in production this
 * would read `remainingRooms` off a live Search API call already made for
 * the home page, not a dedicated query.
 */
export async function getLowAvailabilityHotels(limit = 4): Promise<LowAvailabilityDeal[]> {
  const checkIn = addDaysISO(todayISO(), 14);
  const checkOut = addDaysISO(checkIn, 2);

  const entries = hotelCatalog.listAll();
  const candidates = await Promise.all(
    entries.map(async (entry): Promise<LowAvailabilityDeal | null> => {
      const result = await hotelProvider.getHotelById(entry.appHotelId, {
        destination: "",
        checkIn,
        checkOut,
      });
      if (!result || result.price.remainingRooms === undefined) return null;
      if (result.price.remainingRooms > LOW_AVAILABILITY_THRESHOLD) return null;

      return { result, remainingRooms: result.price.remainingRooms };
    }),
  );

  return candidates
    .filter((c): c is LowAvailabilityDeal => c !== null)
    .sort((a, b) => a.remainingRooms - b.remainingRooms)
    .slice(0, limit);
}
