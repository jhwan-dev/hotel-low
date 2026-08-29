import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Read-only lookup — public SELECT policy, works fine with the anon/session client. */
export async function findHotelRowId(
  supabase: SupabaseClient,
  provider: string,
  providerHotelId: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("hotels")
    .select("id")
    .eq("provider", provider)
    .eq("provider_hotel_id", String(providerHotelId))
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Reverse of findHotelRowId — given the internal uuid, get back the provider ref. Public SELECT policy, session/anon client is enough. */
export async function getHotelProviderRef(
  supabase: SupabaseClient,
  hotelRowId: string,
): Promise<{ provider: string; providerHotelId: string } | null> {
  const { data, error } = await supabase
    .from("hotels")
    .select("provider, provider_hotel_id")
    .eq("id", hotelRowId)
    .maybeSingle();
  if (error) throw error;
  return data ? { provider: data.provider, providerHotelId: data.provider_hotel_id } : null;
}

export interface HotelRowInput {
  provider: string;
  providerHotelId: number;
  name: string;
  city: string;
  country: string;
  address: string;
  rating: number;
  reviewCount: number;
  images: string[];
  amenities: string[];
}

/**
 * Upserts the shared `hotels` catalog row and returns its uuid. RLS grants
 * no INSERT/UPDATE policy on `hotels` to anon/authenticated — this only
 * works because it's called with the admin (service-role) client, from
 * trusted server code. Never call this with a user-scoped client.
 */
export async function ensureHotelRow(admin: SupabaseClient, input: HotelRowInput): Promise<string> {
  const { data, error } = await admin
    .from("hotels")
    .upsert(
      {
        provider: input.provider,
        provider_hotel_id: String(input.providerHotelId),
        name: input.name,
        city: input.city,
        country: input.country,
        address: input.address,
        rating: input.rating,
        review_count: input.reviewCount,
        images: input.images,
        amenities: input.amenities,
      },
      { onConflict: "provider,provider_hotel_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
