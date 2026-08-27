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
}

export interface PricePoint {
  date: string;
  /** Nightly price observed on this date. */
  price: number;
}

export type PriceHistoryRangeDays = 7 | 30 | 90;

export interface PriceHistory {
  hotelId: string;
  currency: Currency;
  /** Daily nightly-price points, oldest first, ending today. */
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
    days: PriceHistoryRangeDays,
  ): Promise<PriceHistory | null>;
}
