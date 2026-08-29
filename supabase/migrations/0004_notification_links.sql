-- Denormalized link info so /alerts can send a click straight to the hotel
-- detail page without a join back through tracked_hotels. Same rationale
-- the original migration already used for price_alerts.user_id: cheaper to
-- duplicate a few columns than to join on every read. hotel_id here is the
-- app catalog id (what hotelProvider.getHotelById expects), not a FK into
-- public.hotels.
alter table public.price_alerts
  add column hotel_id text,
  add column check_in date,
  add column check_out date;
