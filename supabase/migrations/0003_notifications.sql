-- Extends price_alerts (already created in 0001_init.sql) with the explicit
-- previous/current/difference columns the in-app notification UI needs.
-- alert_type already covers all three notification kinds requested
-- ('price_drop', 'target_reached', 'new_low') — nothing to add there.
-- "status" is represented by the existing is_read boolean; the app layer
-- exposes it as status: 'unread' | 'read' rather than adding a second,
-- possibly-drifting column.

alter table public.price_alerts
  rename column triggered_price to current_price;

alter table public.price_alerts
  add column previous_price numeric(12, 2);

alter table public.price_alerts
  add column price_difference numeric(12, 2)
  generated always as (previous_price - current_price) stored;
