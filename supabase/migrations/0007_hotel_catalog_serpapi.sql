-- Tracks whether the SerpApi-backed live lookup has ever found an Agoda
-- rate for this catalog hotel. search()/getHotelById() never call SerpApi
-- themselves (see src/lib/hotels/serpapi/provider.ts) — this lets those
-- paths and tracking-start show something useful instead of silence, and
-- lets tracking-start refuse up front instead of creating a tracked_hotels
-- row with no price behind it.
--
-- No new id column: the SerpApi `property_token` is stored directly in the
-- existing hotels.provider_hotel_id (provider stays 'agoda' — SerpApi is
-- just the lookup path, the price is still an Agoda rate), since that
-- column already means "this provider's opaque id for this hotel" and a
-- second column holding the same thing would just be a sync hazard.
alter table public.hotels
  add column agoda_price_status text not null default 'unknown'
    check (agoda_price_status in ('unknown', 'available', 'unavailable')),
  add column agoda_price_checked_at timestamptz;
