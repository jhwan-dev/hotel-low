-- One new one-time notice fired while a pending tracking resolves its
-- first price (see checkPriceAlerts.ts): tracking_unavailable — the hotel
-- turned out to have no Agoda quote at all, so the tracking was
-- deactivated. Not a price-change event like the three existing types —
-- exempt from detectPriceEvents' dedup-by-day logic entirely. (A pending
-- tracking whose first price already meets the user's target fires an
-- ordinary target_reached instead of a dedicated type, so no new value is
-- needed for that case.)
alter table public.price_alerts
  drop constraint if exists price_alerts_alert_type_check;

alter table public.price_alerts
  add constraint price_alerts_alert_type_check
    check (alert_type in (
      'target_reached',
      'price_drop',
      'new_low',
      'tracking_unavailable'
    ));
