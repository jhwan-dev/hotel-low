import { nightsBetween } from "@/lib/date";
import type { Currency, RoomPrice } from "@/types/hotel";
import type { SerpApiPriceEntry, SerpApiPropertyDetails } from "./types";

interface MergedPriceEntry {
  source: string;
  nightlyWithTax: number | null;
  totalWithTax: number | null;
}

function toMergedEntry(item: SerpApiPriceEntry): MergedPriceEntry {
  return {
    source: item.source,
    nightlyWithTax: item.rate_per_night?.extracted_lowest ?? null,
    totalWithTax: item.total_rate?.extracted_lowest ?? null,
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

/**
 * TODO(travelpayouts): once the Travelpayouts Agoda affiliate link is
 * approved, build the real deep link here. Deliberately NOT using SerpApi's
 * own Agoda link (a Google-ads redirect, not an affiliate link) — returning
 * null until then rather than wiring a link that doesn't earn commission.
 */
export function buildBookingUrl(_appHotelId: string, _checkIn: string, _checkOut: string): string | null {
  return null;
}

/**
 * Maps a SerpApi property-detail response to a RoomPrice, or `null` if
 * Agoda has no quote for this property/stay — not an error, just means
 * there's nothing to show (see HotelProvider.fetchLivePrice callers).
 */
export function mapDetailToRoomPrice(
  detail: SerpApiPropertyDetails,
  appHotelId: string,
  checkIn: string,
  checkOut: string,
): RoomPrice | null {
  const agoda = findAgoda(mergePriceEntries(detail));
  if (!agoda || agoda.nightlyWithTax === null || agoda.totalWithTax === null) return null;

  const currency: Currency = "KRW";
  return {
    hotelId: appHotelId,
    provider: "agoda",
    currency,
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    nightlyPrice: agoda.nightlyWithTax,
    totalPrice: agoda.totalWithTax,
    deepLink: buildBookingUrl(appHotelId, checkIn, checkOut) ?? undefined,
  };
}
