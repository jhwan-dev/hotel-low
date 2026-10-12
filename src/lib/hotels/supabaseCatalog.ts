import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { HotelCatalog, HotelCatalogEntry } from "./catalog";

const PROVIDER = "agoda";

/**
 * Cities the SerpApi catalog-seeding script (scripts/seed-hotel-catalog.ts)
 * actually populates, stored in `hotels.city` in English exactly as SerpApi
 * returns them. Two jobs:
 *  1. Scope every query here to just these — `hotels` still has leftover
 *     rows from the old mock catalog (Korean city names, provider_hotel_id
 *     like "1400001") that predate this provider and were never backfilled
 *     into it; excluding them from search/listAll is cheaper and safer than
 *     deleting rows real users may still reference.
 *  2. Let a Korean city name in a search query (what users actually type —
 *     "오사카", not "Osaka") still match, via CITY_KOREAN_ALIASES below.
 * Add the new city here (and to CITY_KOREAN_ALIASES) when seeding one.
 */
const CATALOG_CITIES = ["Osaka", "Tokyo", "Danang", "Fukuoka"] as const;

const CITY_KOREAN_ALIASES: Record<string, string> = {
  Osaka: "오사카",
  Tokyo: "도쿄",
  Danang: "다낭",
  Fukuoka: "후쿠오카",
};

const SELECT_COLUMNS =
  "id, provider_hotel_id, name, city, country, address, rating, review_count, images, amenities, description, agoda_hid, agoda_detail_path, latitude, longitude";

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
  latitude: number | null;
  longitude: number | null;
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
    latitude: row.latitude,
    longitude: row.longitude,
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

    // A Korean city name (what the UI actually lets people type) doesn't
    // substring-match its English `city` column value, so translate it to
    // an exact-city clause alongside the usual ilike matching.
    const aliasCityMatches = CATALOG_CITIES.filter((city) => {
      const alias = CITY_KOREAN_ALIASES[city];
      return alias.includes(q) || q.includes(alias);
    });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hotels")
      .select(SELECT_COLUMNS)
      .eq("provider", PROVIDER)
      .in("city", CATALOG_CITIES)
      .or(
        [
          `city.ilike.%${q}%`,
          `country.ilike.%${q}%`,
          `name.ilike.%${q}%`,
          ...aliasCityMatches.map((city) => `city.eq.${city}`),
        ].join(","),
      );
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
      .eq("provider", PROVIDER)
      .in("city", CATALOG_CITIES);
    if (error) throw error;
    return (data ?? []).map(toEntry);
  }
}
