export type Currency = "KRW" | "USD" | "JPY" | "THB";

export interface HotelLocation {
  city: string;
  country: string;
  address: string;
}

export interface Hotel {
  id: string;
  name: string;
  location: HotelLocation;
  rating: number;
  reviewCount: number;
  images: string[];
  amenities: string[];
  description: string;
  /** Extra strings (English names, districts) matched against free-text search. */
  aliases: string[];
}

export type PriceProvider = "mock" | "agoda" | "booking";

export interface RoomPrice {
  hotelId: string;
  provider: PriceProvider;
  currency: Currency;
  checkIn: string;
  checkOut: string;
  nights: number;
  /** Price for a single night. */
  nightlyPrice: number;
  /** Price for the full stay (nightlyPrice * nights). */
  totalPrice: number;
  /** Populated once a real booking provider (Agoda/Booking.com) is connected. */
  deepLink?: string;
  /** "detail" = deepLink goes straight to Agoda's own page for this hotel; "search" = it only lands on Agoda's search results for the city (see buildBookingUrl in src/lib/hotels/serpapi/mapper.ts). Drives which button label the UI shows. */
  deepLinkKind?: "detail" | "search";
  /** Rooms left at this rate — undefined when the provider didn't return it. */
  remainingRooms?: number;
  /** When this price was actually observed. Set on a stored/last-known price (search/getHotelById under the SerpApi provider never call a live API — see HotelProvider.fetchLivePrice); omitted for an always-fresh mock/live quote. */
  checkedAt?: string;
  /**
   * Catalog-metadata extracted from this same live detail response — not
   * pricing data, just along for the ride since the call already happened.
   * Only ever set by SerpApiHotelProvider.fetchLivePrice; callers decide
   * whether/how to persist it (see backfillHotelDetails in
   * src/lib/supabase/hotelsTable.ts), and only when the catalog doesn't
   * already have a value, so a live fetch can never overwrite one filled
   * in by hand. Null when this fetch didn't turn up a value either.
   */
  detailAddress?: string | null;
  detailAgodaHid?: string | null;
}

export interface PricePoint {
  /** When this price was observed — matches hotel_price_history.checked_at. */
  checkedAt: string;
  /** Nightly price quoted for the tracked stay as of checkedAt. */
  price: number;
}

export type PriceHistoryRangeDays = 7 | 30 | 90;

/** The guest/room combination a price was quoted for — hotel_price_history is scoped by this, not just (hotelId, checkIn, checkOut). */
export interface PartySize {
  adults: number;
  children: number;
  rooms: number;
}

export interface PriceHistory {
  hotelId: string;
  /** The stay this history tracks — price history is always for one fixed (checkIn, checkOut), re-quoted over time. */
  checkIn: string;
  checkOut: string;
  currency: Currency;
  /** One point per day it was checked, oldest first, ending today. */
  points: PricePoint[];
}

export interface HotelSearchResult {
  hotel: Hotel;
  /** Null means "no stored price for this exact stay yet" — search()/getHotelById() never call a live price API, so this is genuinely absent, not an error. See HotelProvider.fetchLivePrice for the one place that can fill it in. */
  price: RoomPrice | null;
}

export interface HotelSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  /** Mirrors AgodaSearchCriteria — optional so existing callers (detail page, price tracking, home curation) don't need to change. Defaults applied where the provider builds the real request. */
  rooms?: number;
  adults?: number;
  children?: number;
  childrenAges?: number[];
}

export interface HotelSearchResponse {
  params: HotelSearchParams;
  results: HotelSearchResult[];
  totalCount: number;
}

export interface HotelProvider {
  /** Never calls a live price API — reads the catalog and, if any, the latest stored price for this exact stay. */
  search(params: HotelSearchParams): Promise<HotelSearchResponse>;
  /** Never calls a live price API — same contract as search(), for one hotel. */
  getHotelById(
    id: string,
    params: HotelSearchParams,
  ): Promise<HotelSearchResult | null>;
  /**
   * The ONE operation that may actually call a live price API. Callers are
   * responsible for rate-limiting (src/lib/serpapi/callBudget.ts) and for
   * persisting the result (priceHistoryRepository.recordPrice) — this just
   * fetches. Restricted to tracking-start and the price-check cron; never
   * call this from a page render.
   */
  fetchLivePrice(id: string, params: HotelSearchParams): Promise<RoomPrice | null>;
  getPriceHistory(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    days: PriceHistoryRangeDays,
    /** When given, only history recorded for this exact party size is returned. Omit to keep the old, unscoped behavior (used by home-page curation, which has no particular party size). */
    partySize?: PartySize,
  ): Promise<PriceHistory | null>;
}
