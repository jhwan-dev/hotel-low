import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { HotelCatalog, HotelCatalogEntry } from "./catalog";

const PROVIDER = "agoda";

const SELECT_COLUMNS =
  "id, provider_hotel_id, name, city, country, address, rating, review_count, images, amenities, description, agoda_hid, agoda_detail_path";

interface HotelRow {
  id: string;
  provider_hotel_id: string;
  name: string;
  city: string;
  country: string;
  address: string;
  rating: number | null;
  review_count: number;
  images: string[];
  amenities: string[];
  description: string | null;
  agoda_hid: string | null;
  agoda_detail_path: string | null;
}

function toEntry(row: HotelRow): HotelCatalogEntry {
  return {
    appHotelId: row.id,
    providerHotelId: row.provider_hotel_id,
    name: row.name,
    city: row.city,
    country: row.country,
    address: row.address,
    rating: row.rating ?? 0,
    reviewCount: row.review_count,
    images: row.images,
    amenities: row.amenities,
    // No free-text aliases column on `hotels` — destination matching is done
    // server-side via findByDestination's ilike filter instead.
    aliases: [],
    description: row.description ?? "",
    agodaHid: row.agoda_hid,
    agodaDetailPath: row.agoda_detail_path,
  };
}

/**
 * Reads the shared Supabase `hotels` catalog — public SELECT policy, so the
 * session/anon client is enough (seeding/writes go through the admin client
 * elsewhere, e.g. scripts/seed-hotel-catalog.ts). Unlike MockHotelCatalog,
 * this is the real source of truth once SerpApi is the live price provider
 * (see src/lib/hotels/index.ts) — a hotel only shows up here after the
 * catalog-seeding script has run for its city.
 */
export class SupabaseHotelCatalog implements HotelCatalog {
  async findByDestination(destination: string): Promise<HotelCatalogEntry[]> {
    const q = destination.trim().replace(/[,()]/g, "");
    if (!q) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hotels")
      .select(SELECT_COLUMNS)
      .eq("provider", PROVIDER)
      .or(`city.ilike.%${q}%,country.ilike.%${q}%,name.ilike.%${q}%`);
    if (error) throw error;
    return (data ?? []).map(toEntry);
  }

  async findByAppHotelId(appHotelId: string): Promise<HotelCatalogEntry | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hotels")
      .select(SELECT_COLUMNS)
      .eq("id", appHotelId)
      .maybeSingle();
    if (error) throw error;
    return data ? toEntry(data) : null;
  }

  async findByProviderHotelId(providerHotelId: string): Promise<HotelCatalogEntry | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hotels")
      .select(SELECT_COLUMNS)
      .eq("provider", PROVIDER)
      .eq("provider_hotel_id", providerHotelId)
      .maybeSingle();
    if (error) throw error;
    return data ? toEntry(data) : null;
  }

  async listAll(): Promise<HotelCatalogEntry[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hotels")
      .select(SELECT_COLUMNS)
      .eq("provider", PROVIDER);
    if (error) throw error;
    return (data ?? []).map(toEntry);
  }
}
