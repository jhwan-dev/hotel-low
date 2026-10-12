-- Carries each hotel's GPS coordinates straight from SerpApi's list response
-- (google_hotels `properties[].gps_coordinates`) — captured at catalog-seed
-- time (scripts/seed-hotel-catalog.ts), no extra API call needed since the
-- list response already has it. Nullable: the original 22-hotel catalog
-- predates this column and was never backfilled.
alter table public.hotels
  add column latitude double precision,
  add column longitude double precision;
