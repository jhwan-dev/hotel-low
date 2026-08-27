import { hotelCatalog } from "@/lib/hotels";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MockTrackedHotelsRepository } from "./mockRepository";
import type { TrackedHotelsRepository } from "./repository";
import { SupabaseTrackedHotelsRepository } from "./supabaseRepository";

// Swap point: this is the only line that changes once Supabase is connected
// (via NEXT_PUBLIC_SUPABASE_URL / ANON_KEY in .env.local) — every caller
// (Server Actions, the hotel detail page) only ever sees TrackedHotelsRepository.
export const trackedHotelsRepository: TrackedHotelsRepository = isSupabaseConfigured()
  ? new SupabaseTrackedHotelsRepository(hotelCatalog)
  : new MockTrackedHotelsRepository();
