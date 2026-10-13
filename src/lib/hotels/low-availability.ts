import { hotelCatalog, hotelProvider, useSerpApi } from "@/lib/hotels";
import { addDaysISO, todayISO } from "@/lib/date";
import { sample } from "@/lib/random";
import type { Hotel, RoomPrice } from "@/types/hotel";

/** See the matching constant/comment in src/lib/hotels/recent-drops.ts — same reason. */
const SCAN_SIZE = 30;

export interface LowAvailabilityDeal {
  hotel: Hotel;
  price: RoomPrice;
  remainingRooms: number;
}

const LOW_AVAILABILITY_THRESHOLD = 5;

/**
 * Home-page curation: hotels with only a few rooms left at this rate, fewest
 * first. Same placeholder stay and same bounded random sample as
 * getRecentPriceDrops() (see its comment for why) — in production this
 * would read `remainingRooms` off a live Search API call already made for
 * the home page, not a dedicated query.
 *
 * Short-circuits entirely under SerpApi: remainingRooms is only ever set by
 * the mock Agoda path (agoda/mapper.ts) — never by SerpApi's
 * resolveFromStorage/mapDetailToRoomPrice — so every hotel this would
 * otherwise scan is guaranteed to fail the `!== undefined` check below. That
 * made this the single most wasteful call on the home page: up to
 * SCAN_SIZE Supabase round-trips that could never return a single result.
 */
export async function getLowAvailabilityHotels(limit = 4): Promise<LowAvailabilityDeal[]> {
  if (useSerpApi) return [];

  const checkIn = addDaysISO(todayISO(), 14);
  const checkOut = addDaysISO(checkIn, 2);

  const entries = sample(await hotelCatalog.listAll(), SCAN_SIZE);
  const candidates = await Promise.all(
    entries.map(async (entry): Promise<LowAvailabilityDeal | null> => {
      const result = await hotelProvider.getHotelById(entry.appHotelId, {
        destination: "",
        checkIn,
        checkOut,
      });
      if (!result || !result.price || result.price.remainingRooms === undefined) return null;
      if (result.price.remainingRooms > LOW_AVAILABILITY_THRESHOLD) return null;

      return { hotel: result.hotel, price: result.price, remainingRooms: result.price.remainingRooms };
    }),
  );

  return candidates
    .filter((c): c is LowAvailabilityDeal => c !== null)
    .sort((a, b) => a.remainingRooms - b.remainingRooms)
    .slice(0, limit);
}
