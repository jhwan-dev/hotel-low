import type { AgodaContentHotel, AgodaSearchRequest, AgodaSearchResponse } from "./types";

/**
 * The two live Agoda endpoints our app actually needs. This interface is the
 * swap point for real API credentials: MockAgodaRepository implements it
 * with fabricated-but-realistic data today; a RealAgodaRepository would
 * implement it with actual HTTP calls (signing requests, handling
 * pagination/rate limits, etc.) tomorrow — nothing above this interface
 * (mapper, AgodaHotelProvider, the rest of the app) would need to change.
 */
export interface AgodaRepository {
  /** POST to the Search API — live price/room/availability for a set of hotels. */
  searchAvailability(request: AgodaSearchRequest): Promise<AgodaSearchResponse>;

  /** Content API / Hotel Data Feed — static hotel info (name, location, rating, photos, facilities). */
  getHotelContent(hotelIds: number[]): Promise<AgodaContentHotel[]>;
}
