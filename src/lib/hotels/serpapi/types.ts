/**
 * SerpApi `engine=google_hotels` wire shapes — only the fields this app
 * actually reads, confirmed against real saved responses (see
 * scripts/.output/coverage/detail-*.json from verify-agoda-coverage.ts),
 * not guessed from docs alone.
 */

export interface SerpApiPriceBasis {
  lowest?: string;
  extracted_lowest?: number;
  before_taxes_fees?: string;
  extracted_before_taxes_fees?: number;
}

export interface SerpApiPriceEntry {
  source: string;
  link?: string;
  rate_per_night?: SerpApiPriceBasis;
  total_rate?: SerpApiPriceBasis;
}

/** The `engine=google_hotels` property-detail response (keyed by `property_token`). */
export interface SerpApiPropertyDetails {
  property_token: string;
  name?: string;
  /** Only present in the detail response — list/search responses have no address field at all. */
  address?: string;
  prices?: SerpApiPriceEntry[];
  featured_prices?: SerpApiPriceEntry[];
}

/** One entry in the `properties` array of a list/search response — only the fields catalog seeding needs. */
export interface SerpApiListProperty {
  type?: string;
  name: string;
  property_token?: string;
  serpapi_property_details_link?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  hotel_class?: number;
  overall_rating?: number;
  reviews?: number;
  images?: Array<{ thumbnail?: string; original_image?: string }>;
  amenities?: string[];
}

export interface SerpApiSearchResponse {
  properties?: SerpApiListProperty[];
}

export interface SerpApiSearchParams {
  q: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  /** Required by the property-detail call even when going straight to a known property_token — see client.ts. */
  propertyToken?: string;
}
