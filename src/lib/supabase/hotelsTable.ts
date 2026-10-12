import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Read-only lookup — public SELECT policy, works fine with the anon/session client. */
export async function findHotelRowId(
  supabase: SupabaseClient,
  provider: string,
  providerHotelId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("hotels")
    .select("id")
    .eq("provider", provider)
    .eq("provider_hotel_id", providerHotelId)
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
  providerHotelId: string;
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
        provider_hotel_id: input.providerHotelId,
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

/**
 * Records whether a live price check actually found an Agoda rate —
 * written right after tracking-start's one-time fetchLivePrice call (see
 * src/lib/tracking/supabaseRepository.ts), success or failure either way.
 * Admin client only, same reasoning as ensureHotelRow.
 */
export async function updateAgodaPriceStatus(
  admin: SupabaseClient,
  hotelRowId: string,
  status: "available" | "unavailable",
  checkedAt: string,
): Promise<void> {
  const { error } = await admin
    .from("hotels")
    .update({ agoda_price_status: status, agoda_price_checked_at: checkedAt })
    .eq("id", hotelRowId);
  if (error) throw error;
}

/**
 * Fills hotels.address/agoda_hid from a just-fetched live detail response —
 * see RoomPrice.detailAddress/detailAgodaHid (SerpApiHotelProvider.
 * fetchLivePrice), called right after tracking-start's or the price-check
 * cron's one-time fetch, so this never costs an extra SerpApi request.
 * Reads first and only includes a column in the UPDATE if it's currently
 * empty — never overwrites an existing value, including the ones filled in
 * by hand for the original 22 hotels (or one some other process set in the
 * meantime). A no-op if there's nothing to offer or nothing to fill.
 */
export async function backfillHotelDetails(
  admin: SupabaseClient,
  hotelRowId: string,
  detail: { address: string | null; agodaHid: string | null },
): Promise<void> {
  if (!detail.address && !detail.agodaHid) return;

  const { data, error: selectError } = await admin
    .from("hotels")
    .select("address, agoda_hid")
    .eq("id", hotelRowId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!data) return;

  const patch: { address?: string; agoda_hid?: string } = {};
  if (detail.address && !data.address) patch.address = detail.address;
  if (detail.agodaHid && !data.agoda_hid) patch.agoda_hid = detail.agodaHid;
  if (Object.keys(patch).length === 0) return;

  const { error } = await admin.from("hotels").update(patch).eq("id", hotelRowId);
  if (error) throw error;
}
