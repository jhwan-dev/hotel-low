import { hotelCatalog, hotelProvider, useSerpApi } from "@/lib/hotels";
import { addDaysISO, todayISO, todayISOInSeoul } from "@/lib/date";
import { priceStats } from "@/lib/hotels/price-history";
import { sample } from "@/lib/random";
import { createClient } from "@/lib/supabase/server";
import type { Hotel, PartySize, PricePoint, RoomPrice } from "@/types/hotel";

/** Catalog entries scanned per home-page load in the mock-catalog fallback path below — see its comment for why a scan (rather than the real-combo query) is still used there. */
const SCAN_SIZE = 30;

/** How far back (from today) the real-combo query looks for history to average against — mirrors the 30-day window the old per-hotel getPriceHistory(..., 30) call used. */
const HISTORY_WINDOW_DAYS = 30;

/** Upper bound on rows pulled for the real-combo scan — bounds payload size as hotel_price_history grows; not a correctness requirement (a combo missed here just doesn't get a chance to show up this load). */
const MAX_HISTORY_ROWS = 5000;

export interface PriceDrop {
  hotel: Hotel;
  price: RoomPrice;
  /** The exact party size this price was quoted for — needed to link back to the hotel detail page with the same stay query, not just whatever it defaults to. */
  partySize: PartySize;
  /** Positive percent below the 30-day average, e.g. 12 means "12% cheaper than usual". */
  percentDrop: number;
  /** True when the current price matches (or beats) the 30-day low — worth a standout badge. */
  isRecordLow: boolean;
}

interface CandidateKey {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  partySize: PartySize;
}

/**
 * Home-page curation: hotels currently priced below their own recent
 * average, biggest drop first. Under SerpApi (the production path —
 * `useSerpApi`), this reads real (hotel, checkIn, checkOut, partySize)
 * combos straight out of `hotel_price_history` — only stays someone has
 * actually tracked/checked ever show up, so there's always real history to
 * compare against. The old fixed-schedule random catalog sample
 * (`scanFixedScheduleSample` below) is kept only as the mock-catalog
 * fallback, where mock-pricing synthesizes history for any schedule anyway.
 */
export async function getRecentPriceDrops(limit = 4): Promise<PriceDrop[]> {
  if (useSerpApi) return scanRealCombos(limit);
  return scanFixedScheduleSample(limit);
}

/**
 * One query against `hotel_price_history` for every (hotel, checkIn,
 * checkOut, partySize) combo with an upcoming check-in, grouped and
 * compared against its own trailing average in application code — instead
 * of a round trip per catalog entry (SCAN_SIZE × 2 under the old approach).
 * Only the winning candidates (at most `limit`) then cost a further
 * round trip each, to resolve the Hotel + a freshly-read RoomPrice through
 * the normal HotelProvider path (so deepLink/nights/totalPrice etc. are
 * built the same way every other card on the site builds them).
 */
async function scanRealCombos(limit: number): Promise<PriceDrop[]> {
  const todaySeoul = todayISOInSeoul();
  const since = addDaysISO(todaySeoul, -HISTORY_WINDOW_DAYS);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hotel_price_history")
    .select("hotel_id, check_in, check_out, adults, children, rooms, price, checked_at")
    .gte("check_in", todaySeoul)
    .gte("checked_at", since)
    .order("checked_at", { ascending: true })
    .limit(MAX_HISTORY_ROWS);
  if (error) throw error;

  // Keyed groups, built in checked_at-ascending order (same order the query
  // returned), so each group's points end up chronological too — priceStats
  // picks its "current" price as the last point, so that ordering matters.
  const groups = new Map<string, CandidateKey & { points: PricePoint[] }>();
  for (const row of data ?? []) {
    const key = `${row.hotel_id}::${row.check_in}::${row.check_out}::${row.adults}::${row.children}::${row.rooms}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        hotelId: row.hotel_id,
        checkIn: row.check_in,
        checkOut: row.check_out,
        partySize: { adults: row.adults, children: row.children, rooms: row.rooms },
        points: [],
      };
      groups.set(key, group);
    }
    group.points.push({ checkedAt: String(row.checked_at), price: Number(row.price) });
  }

  const candidates: Array<CandidateKey & { percentDrop: number; isRecordLow: boolean }> = [];
  for (const group of groups.values()) {
    const stats = priceStats(group.points);
    if (stats.current >= stats.avg) continue;

    const percentDrop = Math.round(((stats.avg - stats.current) / stats.avg) * 100);
    if (percentDrop <= 0) continue;

    candidates.push({
      hotelId: group.hotelId,
      checkIn: group.checkIn,
      checkOut: group.checkOut,
      partySize: group.partySize,
      percentDrop,
      isRecordLow: stats.current <= stats.min,
    });
  }

  const top = candidates.sort((a, b) => b.percentDrop - a.percentDrop).slice(0, limit);

  const resolved = await Promise.all(
    top.map(async (c): Promise<PriceDrop | null> => {
      const result = await hotelProvider.getHotelById(c.hotelId, {
        destination: "",
        checkIn: c.checkIn,
        checkOut: c.checkOut,
        adults: c.partySize.adults,
        children: c.partySize.children,
        rooms: c.partySize.rooms,
      });
      if (!result || !result.price) return null;

      return {
        hotel: result.hotel,
        price: result.price,
        partySize: c.partySize,
        percentDrop: c.percentDrop,
        isRecordLow: c.isRecordLow,
      };
    }),
  );

  return resolved.filter((c): c is PriceDrop => c !== null);
}

/**
 * Mock-catalog fallback (no SerpApi configured): same placeholder stay (2
 * weeks out, 2 nights, default party) and bounded random sample as before —
 * mock-pricing fabricates deterministic history for any schedule, so
 * "real combos" doesn't mean anything in this mode.
 */
async function scanFixedScheduleSample(limit: number): Promise<PriceDrop[]> {
  const checkIn = addDaysISO(todayISO(), 14);
  const checkOut = addDaysISO(checkIn, 2);
  const partySize: PartySize = { adults: 2, children: 0, rooms: 1 };

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

      return {
        hotel: result.hotel,
        price,
        partySize,
        percentDrop,
        isRecordLow: price.nightlyPrice <= stats.min,
      };
    }),
  );

  return candidates
    .filter((c): c is PriceDrop => c !== null)
    .sort((a, b) => b.percentDrop - a.percentDrop)
    .slice(0, limit);
}
