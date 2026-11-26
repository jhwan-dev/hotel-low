-- SupabaseTrackedHotelsRepository.upsert used to reject tracking-start
-- outright when SerpApi's shared daily call budget was already spent
-- (TrackingRejectedError). It now registers the tracking anyway, as
-- "pending" — the price-check cron fills in the first price (and a
-- default target, if the user didn't set one) on its next run. See
-- checkPriceAlerts.ts.
--
-- target_price was NOT NULL CHECK(>0): nothing could ever insert a
-- tracking without a confirmed price to compute a target against. A
-- pending row has no price yet, so it has no target either — relax the
-- column to nullable, keep the positivity check for whenever it IS set.
alter table public.tracked_hotels
  alter column target_price drop not null;

alter table public.tracked_hotels
  drop constraint if exists tracked_hotels_target_price_check;

alter table public.tracked_hotels
  add constraint tracked_hotels_target_price_check
    check (target_price is null or target_price > 0);

-- Explicit, queryable state — distinct from is_active (which only ever
-- means "has the user stopped this"). Every tracking created outside a
-- budget crunch goes straight to "active"; only a budget-exhausted
-- creation starts "pending".
alter table public.tracked_hotels
  add column status text not null default 'active' check (status in ('pending', 'active'));
