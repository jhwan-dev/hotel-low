-- The total stay price (nightly × nights × rooms) the moment this tracking
-- was confirmed active — set once, never touched again by a settings edit
-- (notify toggles / target price), only by a fresh registration, a
-- party-size change (which re-registers), or a pending→active transition.
-- Lets every "추적 시작가 대비 N% 하락" figure (notifications, hotel detail
-- page) read this directly instead of re-deriving it from history on every
-- use. Nullable: a still-pending row has no price yet, so no baseline
-- either.
alter table public.tracked_hotels
  add column baseline_price numeric(12, 2);

-- Backfill every pre-existing (is_active) row from hotel_price_history:
-- the first price actually recorded for its exact (hotel, stay, party) at
-- or after this row's own created_at — not just the earliest point ever
-- recorded for that combo, which could predate this particular tracking
-- (another user's earlier tracking of the same stay, or a pre-tracking
-- catalog check). Left NULL when no such point exists.
update public.tracked_hotels th
set baseline_price = (
  select hph.price * (th.check_out - th.check_in) * th.rooms
  from public.hotel_price_history hph
  where hph.hotel_id = th.hotel_id
    and hph.check_in = th.check_in
    and hph.check_out = th.check_out
    and hph.adults = th.adults
    and hph.children = th.children
    and hph.rooms = th.rooms
    and hph.checked_at >= th.created_at
  order by hph.checked_at asc
  limit 1
)
where th.is_active = true;
