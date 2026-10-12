import { nightsBetween } from "@/lib/date";
import type { Currency, RoomPrice } from "@/types/hotel";
import type { SerpApiPriceEntry, SerpApiPropertyDetails } from "./types";

interface MergedPriceEntry {
  source: string;
  nightlyWithTax: number | null;
}

function toMergedEntry(item: SerpApiPriceEntry): MergedPriceEntry {
  return {
    source: item.source,
    nightlyWithTax: item.rate_per_night?.extracted_lowest ?? null,
  };
}

/**
 * `prices` and `featured_prices` can each carry sources the other is
 * missing (confirmed directly against cached responses — a hotel can show
 * Agoda in one and not the other), so union both rather than treating one
 * as a fallback for an empty other. When both list the same OTA, the
 * `prices` copy wins (iterated first) — every sample checked had identical
 * numbers either way.
 */
function mergePriceEntries(detail: SerpApiPropertyDetails): MergedPriceEntry[] {
  const bySource = new Map<string, MergedPriceEntry>();
  for (const item of [...(detail.prices ?? []), ...(detail.featured_prices ?? [])]) {
    const key = item.source.toLowerCase();
    if (!bySource.has(key)) bySource.set(key, toMergedEntry(item));
  }
  return [...bySource.values()];
}

function findAgoda(entries: MergedPriceEntry[]): MergedPriceEntry | null {
  return entries.find((e) => e.source.toLowerCase() === "agoda") ?? null;
}

/** Only present in the detail response — list responses have no address field at all. Null (not "") when absent, so callers can tell "nothing to backfill with" apart from "explicitly blank". */
export function extractAddress(detail: SerpApiPropertyDetails): string | null {
  return detail.address && detail.address.length > 0 ? detail.address : null;
}

/**
 * Agoda's own numeric hotel id, decoded out of the Agoda price entry's
 * `link` (a Google-ads redirect whose `pcurl` query param is Agoda's own
 * partnersearch.aspx URL, which carries `hid`) — same decode
 * scripts/fill-agoda-hid.ts does from a cached detail response, just run
 * against a live one here instead.
 */
export function extractAgodaHid(detail: SerpApiPropertyDetails): string | null {
  const agoda = [...(detail.prices ?? []), ...(detail.featured_prices ?? [])].find(
    (item) => item.source.toLowerCase() === "agoda",
  );
  if (!agoda?.link) return null;

  try {
    const outer = new URL(agoda.link);
    const pcurl = outer.searchParams.get("pcurl");
    if (!pcurl) return null;
    const inner = new URL(pcurl);
    return inner.searchParams.get("hid");
  } catch {
    return null;
  }
}

export type BookingLinkKind = "detail" | "search";

export interface BookingLink {
  url: string;
  kind: BookingLinkKind;
}

/** The two catalog fields buildBookingUrl needs — see HotelCatalogEntry.agodaHid/agodaDetailPath. */
export interface AgodaBookingRef {
  hid?: string | null;
  detailPath?: string | null;
}

export interface BookingStay {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  childrenAges?: number[];
  rooms: number;
}

/**
 * Builds a link to Agoda's own site for this stay. Two tiers, in priority
 * order, both browser-verified by hand (not just curl'd — see
 * notes/summary.md for why that distinction mattered here):
 *
 * 1. `detailPath` set → Agoda's real canonical detail page
 *    (agoda.com/ko-kr/<slug>/hotel/<city-code>.html). Confirmed params:
 *    `checkin` is lowercase (not `checkIn`) and there's no `checkOut` at
 *    all — Agoda derives the stay from `checkin` + `los` (length of stay,
 *    nights), not a date range.
 * 2. Only `hid` set → the partnersearch.aspx fallback. This lands on
 *    *search results* for the hotel's city, not the hotel itself (verified
 *    in-browser and rejected as the primary link — a mistyped/ambiguous hid
 *    can surface a different, even sponsored, hotel at the top) — it's
 *    kept only as a better-than-nothing fallback for hotels nobody's filled
 *    a detail path in for yet, and it does correctly reflect the dates.
 * 3. Neither set → null (no booking link shown at all).
 *
 * Deliberately never includes Agoda's own session/tracking params (ckuid,
 * userId, cid, correlationId, ...) — those are Agoda's affiliate/analytics
 * plumbing, not anything a plain outbound link needs, and baking in a
 * guessed value for one would be worse than omitting it.
 */
export function buildBookingUrl(ref: AgodaBookingRef, stay: BookingStay): BookingLink | null {
  if (ref.detailPath) {
    const nights = nightsBetween(stay.checkIn, stay.checkOut);
    const params = new URLSearchParams();
    params.set("adults", String(stay.adults));
    params.set("rooms", String(stay.rooms));
    if (stay.children > 0) {
      params.set("childs", String(stay.children));
      // TODO(unverified): only tested with a single child (age 5) in a real
      // browser — comma-separation for multiple children's ages is a guess,
      // not confirmed. Re-check before relying on this for >1 child.
      if (stay.childrenAges && stay.childrenAges.length > 0) {
        params.set("childages", stay.childrenAges.join(","));
      }
    }
    params.set("currency", "KRW");
    params.set("checkin", stay.checkIn);
    params.set("los", String(nights));
    const path = ref.detailPath.replace(/^\/+/, "");
    return { url: `https://www.agoda.com/ko-kr/${path}?${params.toString()}`, kind: "detail" };
  }

  if (ref.hid) {
    const params = new URLSearchParams();
    params.set("hid", ref.hid);
    params.set("checkin", stay.checkIn);
    params.set("checkout", stay.checkOut);
    params.set("NumberofAdults", String(stay.adults));
    params.set("NumberofChildren", String(stay.children));
    params.set("Rooms", String(stay.rooms));
    params.set("currency", "KRW");
    return {
      url: `https://www.agoda.com/ko-kr/partners/partnersearch.aspx?${params.toString()}`,
      kind: "search",
    };
  }

  return null;
}

/**
 * Maps a SerpApi property-detail response to a RoomPrice, or `null` if
 * Agoda has no quote for this property/stay — not an error, just means
 * there's nothing to show (see HotelProvider.fetchLivePrice callers).
 *
 * `totalPrice` is computed here, not read off SerpApi's own `total_rate` —
 * google_hotels has no "number of rooms" request param at all (it only ever
 * quotes one room), so `total_rate` for a multi-night stay is just
 * `rate_per_night × nights`, never `× rooms`. nightlyPrice/nightlyWithTax
 * stays "per room per night" (the convention hotel_price_history already
 * uses), and `rooms` is applied here exactly like the Agoda-mock path does.
 */
export function mapDetailToRoomPrice(
  detail: SerpApiPropertyDetails,
  appHotelId: string,
  checkIn: string,
  checkOut: string,
  rooms: number,
): RoomPrice | null {
  const agoda = findAgoda(mergePriceEntries(detail));
  if (!agoda || agoda.nightlyWithTax === null) return null;

  const currency: Currency = "KRW";
  const nights = nightsBetween(checkIn, checkOut);
  return {
    hotelId: appHotelId,
    provider: "agoda",
    currency,
    checkIn,
    checkOut,
    nights,
    nightlyPrice: agoda.nightlyWithTax,
    totalPrice: agoda.nightlyWithTax * nights * rooms,
  };
}
