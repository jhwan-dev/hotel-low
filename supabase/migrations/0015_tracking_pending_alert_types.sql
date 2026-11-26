-- Two new one-time notices fired while a pending tracking resolves its
-- first price (see checkPriceAlerts.ts): tracking_unavailable (the hotel
-- turned out to have no Agoda quote at all — tracking was deactivated) and
-- target_price_adjusted (the user's own target was already met by the
-- first price, so a fresh one was computed instead). Neither is a
-- price-change event like the three existing types — they're exempt from
-- detectPriceEvents' dedup-by-day logic entirely.
alter table public.price_alerts
  drop constraint if exists price_alerts_alert_type_check;

alter table public.price_alerts
  add constraint price_alerts_alert_type_check
    check (alert_type in (
      'target_reached',
      'price_drop',
      'new_low',
      'tracking_unavailable',
      'target_price_adjusted'
    ));
