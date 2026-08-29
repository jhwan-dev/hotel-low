-- Carries the guest/room counts a tracked stay was started with, so the
-- price shown while tracking (and the price the price-check job re-quotes)
-- matches what the user actually selected, not a silent 1-room/2-adult
-- default. Mirrors the adults/children/rooms fields added to
-- PriceTrackingSettings in src/types/tracking.ts.
alter table public.tracked_hotels
  add column adults integer not null default 2 check (adults > 0),
  add column children integer not null default 0 check (children >= 0),
  add column rooms integer not null default 1 check (rooms > 0);
