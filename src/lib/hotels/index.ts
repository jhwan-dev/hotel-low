import { AgodaHotelProvider } from "./agoda/hotelProvider";
import { MockAgodaRepository } from "./agoda/mockRepository";
import { MockHotelCatalog, type HotelCatalog } from "./catalog";
import {
  MockPriceHistoryRepository,
  SupabasePriceHistoryRepository,
  type PriceHistoryRepository,
} from "./price-history-repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { HotelProvider } from "@/types/hotel";

// Swap point 1/3: once Agoda API credentials are available, replace
// MockAgodaRepository with a real HTTP-backed AgodaRepository (see
// ./agoda/repository.ts). Nothing that calls `hotelProvider` needs to change.
const agodaRepository = new MockAgodaRepository();

// Swap point 2/3: HotelCatalog resolves "destination text" -> Agoda hotel
// ids. Mock reads mock-data.ts; once Supabase is configured a
// SupabaseHotelCatalog reading the `hotels` table would replace this.
export const hotelCatalog: HotelCatalog = new MockHotelCatalog();

// Swap point 3/3: price history has no Agoda equivalent — it's our own log
// (Supabase `hotel_price_history`). Falls back to the deterministic mock
// generator until NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are set in .env.local.
const priceHistoryRepository: PriceHistoryRepository = isSupabaseConfigured()
  ? new SupabasePriceHistoryRepository(hotelCatalog)
  : new MockPriceHistoryRepository();

export const hotelProvider: HotelProvider = new AgodaHotelProvider(
  agodaRepository,
  hotelCatalog,
  priceHistoryRepository,
);

export { supportedDestinations } from "./destinations";
