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
  /** Rooms left at this rate — undefined when the provider didn't return it. */
  remainingRooms?: number;
}

export interface PricePoint {
  /** When this price was observed — matches hotel_price_history.checked_at. */
  checkedAt: string;
  /** Nightly price quoted for the tracked stay as of checkedAt. */
  price: number;
}

export type PriceHistoryRangeDays = 7 | 30 | 90;

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
  price: RoomPrice;
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
  search(params: HotelSearchParams): Promise<HotelSearchResponse>;
  getHotelById(
    id: string,
    params: HotelSearchParams,
  ): Promise<HotelSearchResult | null>;
  getPriceHistory(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    days: PriceHistoryRangeDays,
  ): Promise<PriceHistory | null>;
}
