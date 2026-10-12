-- Carries the guest/room counts a recorded price was quoted for, mirroring
-- the adults/children/rooms fields 0005_tracking_guests.sql added to
-- tracked_hotels. Without this, two trackings of the same hotel/dates but
-- different party sizes would read/share the exact same history rows,
-- scaled differently (see src/lib/hotels/price-history-repository.ts).
alter table public.hotel_price_history
  add column adults integer not null default 2 check (adults > 0),
  add column children integer not null default 0 check (children >= 0),
  add column rooms integer not null default 1 check (rooms > 0);

-- Replaces hotel_price_history_lookup_idx (hotel_id, check_in, check_out,
-- checked_at) from 0001_init.sql — same lookup, now scoped to party size too.
drop index if exists hotel_price_history_lookup_idx;

create index hotel_price_history_lookup_idx
  on public.hotel_price_history (hotel_id, check_in, check_out, adults, children, rooms, checked_at);
