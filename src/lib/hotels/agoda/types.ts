/**
 * Wire-format types for Agoda's Demand API, kept as close to the official
 * field names/shapes as https://developer.agoda.com/demand/docs let us
 * verify (Search API + Content API / Hotel Data Feed). These are NOT our
 * app's domain types (see src/types/hotel.ts) — they exist so the mapping
 * layer (./mapper.ts) has a single, honest place to translate Agoda's shape
 * into ours, instead of that translation being smeared across the app.
 *
 * Two APIs, two concerns, matching Agoda's own split:
 * - Search API   -> live price / room / availability (AgodaSearch*)
 * - Content API  -> static hotel info: name, location, rating, photos,
 *                    facilities (AgodaContent*)
 * Agoda's Search API has no historical-price endpoint; that's covered
 * separately by ../price-history-repository.ts, backed by our own data.
 */

// ---------------------------------------------------------------------------
// Search API — https://developer.agoda.com/demand/docs/json-search-api
// ---------------------------------------------------------------------------

export type AgodaExtraFeature =
  | "content"
  | "dailyRate"
  | "benefitDetail"
  | "cancellationDetail"
  | "taxDetail"
  | "surchargeDetail"
  | "promotionDetail"
  | "metaSearch";

export interface AgodaSearchCriteria {
  /** Agoda hotel ids. Max 100 per request. */
  propertyIds: number[];
  /** YYYY-MM-DD */
  checkIn: string;
  /** YYYY-MM-DD */
  checkOut: string;
  rooms: number;
  adults: number;
  children?: number;
  childrenAges?: number[];
  /** ISO 4217, e.g. "KRW" */
  currency: string;
  /** e.g. "en-us", "ko-kr" */
  language: string;
  /** ISO 3166-1 alpha-2 */
  userCountry?: string;
}

export interface AgodaSearchFeatures {
  ratesPerProperty?: number;
  extra?: AgodaExtraFeature[];
}

export interface AgodaSearchRequest {
  criteria: AgodaSearchCriteria;
  features?: AgodaSearchFeatures;
  /** Max wait time in seconds before Agoda returns partial results. */
  waitTime?: number;
}

export interface AgodaRate {
  currency: string;
  /** Pre-tax. */
  exclusive: number;
  /** Tax/fees included — the number to show as "the price". */
  inclusive: number;
  tax: number;
  fees: number;
  /** PRPN = per room per night, PB = per booking, PN = per night. */
  method: "PRPN" | "PB" | "PN";
}

export interface AgodaTotalPayment {
  inclusive: number;
  exclusive: number;
  minSellPrice: number;
}

export interface AgodaDailyRate {
  /** YYYY-MM-DD */
  date: string;
  rate: number;
}

export interface AgodaRoom {
  roomId: number;
  blockId: string;
  /** Only present when features.extra includes "content". */
  roomName?: string;
  translatedRoomName?: string;
  parentRoomId: number;
  ratePlanId: number;
  freeBreakfast: boolean;
  freeCancellation: boolean;
  paymentModel: "Agency" | "Merchant" | "MerchantCommission";
  rate: AgodaRate;
  totalPayment: AgodaTotalPayment;
  /** Only present when features.extra includes "dailyRate". */
  dailyRate?: AgodaDailyRate[];
  /** Only present when features.extra includes "rateDetail". */
  remainingRooms?: number;
  /** Booking deep link — only present when features.extra includes "metaSearch". */
  landingUrl?: string;
}

export interface AgodaProperty {
  propertyId: number;
  /** Only present when features.extra includes "content". */
  propertyName?: string;
  translatedPropertyName?: string;
  propertyUtcOffset?: string;
  rooms: AgodaRoom[];
}

export interface AgodaSearchResponse {
  /** Unique id Agoda assigns to this search — useful for support/debugging. */
  searchId: number;
  properties: AgodaProperty[];
}

// ---------------------------------------------------------------------------
// Content API / Hotel Data Feed —
// https://developer.agoda.com/demand/docs/content-api
// ---------------------------------------------------------------------------

export interface AgodaContentAddress {
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
  state?: string;
  city: string;
  country: string;
}

export interface AgodaContentPicture {
  pictureId: number;
  url: string;
  caption?: string;
  captionTranslated?: string;
  /** e.g. "ROOM", "LOBBY", "EXTERIOR" */
  pictureGroup: string;
}

export interface AgodaContentFacility {
  propertyId: number;
  propertyName: string;
  propertyTranslatedName?: string;
  propertyGroupDescription?: string;
}

export interface AgodaContentHotel {
  /** Same id space as AgodaProperty.propertyId / AgodaSearchCriteria.propertyIds. */
  hotelId: number;
  hotelName: string;
  translatedName?: string;
  starRating: number;
  /** Weighted guest review score. */
  ratingAverage: number;
  numberOfReviews: number;
  continentId: number;
  countryId: number;
  cityId: number;
  areaId?: number;
  longitude: number;
  latitude: number;
  address: AgodaContentAddress;
  pictures: AgodaContentPicture[];
  facilities: AgodaContentFacility[];
}
