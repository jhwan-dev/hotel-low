import { AgodaHotelProvider } from "./agoda/hotelProvider";
import { MockAgodaRepository } from "./agoda/mockRepository";
import { MockHotelCatalog, type HotelCatalog } from "./catalog";
import {
  MockPriceHistoryRepository,
  SupabasePriceHistoryRepository,
  type PriceHistoryRepository,
} from "./price-history-repository";
import { SerpApiHotelProvider } from "./serpapi/provider";
import { isSerpApiConfigured } from "./serpapi/env";
import { SupabaseHotelCatalog } from "./supabaseCatalog";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { HotelProvider } from "@/types/hotel";

// SerpApi is the real price source once SERPAPI_API_KEY is set; otherwise
// everything below falls back to the original mock path (MockAgodaRepository
// + MockHotelCatalog) exactly as before. SerpApi mode additionally requires
// Supabase (the catalog and price history it reads both live there) —
// isSerpApiConfigured() alone does not skip that requirement.
// Also read by getLowAvailabilityHotels (src/lib/hotels/low-availability.ts)
// to skip itself entirely under SerpApi — remainingRooms is only ever
// populated by the mock Agoda path (agoda/mapper.ts), never by SerpApi's,
// so every hotel it would scan is guaranteed to fail its own filter.
export const useSerpApi = isSerpApiConfigured() && isSupabaseConfigured();

export const hotelCatalog: HotelCatalog = useSerpApi
  ? new SupabaseHotelCatalog()
  : new MockHotelCatalog();

// Exported (not just wired into the provider) because the price-check job
// needs to *write* a new price point, not just read the graph through
// HotelProvider.getPriceHistory — see src/lib/notifications/checkPriceAlerts.ts.
export const priceHistoryRepository: PriceHistoryRepository = isSupabaseConfigured()
  ? new SupabasePriceHistoryRepository(hotelCatalog)
  : new MockPriceHistoryRepository();

export const hotelProvider: HotelProvider = useSerpApi
  ? new SerpApiHotelProvider(hotelCatalog, priceHistoryRepository)
  : new AgodaHotelProvider(new MockAgodaRepository(), hotelCatalog, priceHistoryRepository);

export { supportedDestinations } from "./destinations";
