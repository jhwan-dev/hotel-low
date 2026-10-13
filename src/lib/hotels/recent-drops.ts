import { hotelCatalog, hotelProvider } from "@/lib/hotels";
import { addDaysISO, todayISO } from "@/lib/date";
import { priceStats } from "@/lib/hotels/price-history";
import { sample } from "@/lib/random";
import type { Hotel, RoomPrice } from "@/types/hotel";

/** Catalog entries scanned per home-page load — see the comment on getRecentPriceDrops below for why this is capped instead of scanning everything. */
const SCAN_SIZE = 30;

export interface PriceDrop {
  hotel: Hotel;
  price: RoomPrice;
  /** Positive percent below the 30-day average, e.g. 12 means "12% cheaper than usual". */
  percentDrop: number;
  /** True when the current price matches (or beats) the 30-day low — worth a standout badge. */
  isRecordLow: boolean;
}

/**
 * Home-page curation: hotels currently priced below their own 30-day
 * average, biggest drop first, for one placeholder stay (2 weeks out, 2
 * nights) since there's no specific search context on the home screen yet.
 *
 * Scans a random sample of the catalog, not all of it — each entry costs 2
 * Supabase round-trips (getHotelById + getPriceHistory), and the catalog
 * grew to 400 rows across 4 cities; scanning all of it on every home-page
 * load (compounded by getLowAvailabilityHotels doing the same thing
 * alongside it) was enough concurrent load to produce Supabase gateway
 * timeouts and a multi-second home page regardless of who's signed in —
 * found while chasing an unrelated reviewer-login report. In production
 * this would be a single aggregate query against Supabase
 * `hotel_price_history` (group by hotel, compare latest vs avg) rather than
 * a round-trip per hotel at all.
 */
export async function getRecentPriceDrops(limit = 4): Promise<PriceDrop[]> {
  const checkIn = addDaysISO(todayISO(), 14);
  const checkOut = addDaysISO(checkIn, 2);

  const entries = sample(await hotelCatalog.listAll(), SCAN_SIZE);
  const candidates = await Promise.all(
    entries.map(async (entry): Promise<PriceDrop | null> => {
      const [result, history] = await Promise.all([
        hotelProvider.getHotelById(entry.appHotelId, {
          destination: "",
          checkIn,
          checkOut,
        }),
        hotelProvider.getPriceHistory(entry.appHotelId, checkIn, checkOut, 30),
      ]);
      if (!result || !result.price || !history || history.points.length === 0) return null;
      const price = result.price;

      const stats = priceStats(history.points);
      if (price.nightlyPrice >= stats.avg) return null;

      const percentDrop = Math.round(((stats.avg - price.nightlyPrice) / stats.avg) * 100);
      if (percentDrop <= 0) return null;

      return { hotel: result.hotel, price, percentDrop, isRecordLow: price.nightlyPrice <= stats.min };
    }),
  );

  return candidates
    .filter((c): c is PriceDrop => c !== null)
    .sort((a, b) => b.percentDrop - a.percentDrop)
    .slice(0, limit);
}
