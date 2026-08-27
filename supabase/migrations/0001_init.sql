-- HOTELow initial schema
-- Tables: users, trips, tracked_hotels, hotels, hotel_price_history, price_alerts
-- This file is a DRAFT for review. Do not run it against a live project until
-- you've read through it — see the accompanying explanation for the reasoning
-- behind each choice (PK type, FK on-delete behavior, indexes, RLS).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helper: keep `updated_at` current on every UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users — one row per authenticated person, 1:1 with auth.users.
-- Supabase Auth owns auth.users (email, password hash, etc.); we can't add
-- app-specific columns to it directly, so `public.users` extends it via a
-- shared primary key and a trigger that keeps it in sync on signup.
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Auto-create a public.users row whenever someone signs up via Supabase Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- hotels — shared catalog cache, one row per hotel per source provider.
-- Populated server-side (search results get upserted here) so tracked_hotels
-- and hotel_price_history have a stable internal id to point at regardless of
-- which provider (mock/Agoda/Booking.com) the hotel came from.
-- ---------------------------------------------------------------------------
create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('mock', 'agoda', 'booking')),
  provider_hotel_id text not null,
  name text not null,
  city text not null,
  country text not null,
  address text not null,
  rating numeric(2, 1) check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  images text[] not null default '{}',
  amenities text[] not null default '{}',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_hotel_id)
);

create index hotels_city_idx on public.hotels (city);

create trigger set_hotels_updated_at
  before update on public.hotels
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- trips — a user's travel dates for a destination. Groups tracked_hotels;
-- optional today since the UI can track a hotel without an explicit trip yet.
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  destination text not null,
  check_in date not null,
  check_out date not null,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_valid check (check_out > check_in)
);

create index trips_user_id_idx on public.trips (user_id);
create index trips_user_id_check_in_idx on public.trips (user_id, check_in);

create trigger set_trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tracked_hotels — one row per "가격 추적 시작" action: which hotel, which
-- stay, at what target price, under which alert conditions. Mirrors
-- PriceTrackingSettings in src/types/tracking.ts.
-- ---------------------------------------------------------------------------
create table public.tracked_hotels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  check_in date not null,
  check_out date not null,
  target_price numeric(12, 2) not null check (target_price > 0),
  currency text not null,
  notify_on_any_drop boolean not null default true,
  notify_on_new_low boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracked_hotels_dates_valid check (check_out > check_in)
);

create index tracked_hotels_user_id_idx on public.tracked_hotels (user_id);
create index tracked_hotels_hotel_id_idx on public.tracked_hotels (hotel_id);
create index tracked_hotels_trip_id_idx on public.tracked_hotels (trip_id);

-- Only one *active* tracking per user+hotel+stay — stopping tracking (soft
-- delete via is_active = false) frees up the slot instead of hard-deleting
-- history.
create unique index tracked_hotels_unique_active_stay
  on public.tracked_hotels (user_id, hotel_id, check_in, check_out)
  where is_active;

create trigger set_tracked_hotels_updated_at
  before update on public.tracked_hotels
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- hotel_price_history — append-only log that drives the price graph. Each
-- row is "what did `provider` quote for this exact (hotel, check_in,
-- check_out) stay, the moment we checked at `checked_at`". A bigint identity
-- PK (not uuid) because this is the highest-write-volume table in the schema
-- (polled repeatedly per tracked stay) and a monotonic integer indexes/stores
-- more efficiently than a uuid for a pure time-series log.
-- ---------------------------------------------------------------------------
create table public.hotel_price_history (
  id bigint generated always as identity primary key,
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  check_in date not null,
  check_out date not null,
  provider text not null check (provider in ('mock', 'agoda', 'booking')),
  price numeric(12, 2) not null check (price >= 0),
  currency text not null,
  checked_at timestamptz not null default now(),
  booking_url text,
  created_at timestamptz not null default now(),
  -- Rows here are never edited after insert; kept only for schema
  -- consistency with the rest of the tables. Expect updated_at == created_at.
  updated_at timestamptz not null default now(),
  constraint hotel_price_history_dates_valid check (check_out > check_in)
);

-- The one query this table exists to serve: "price history for hotel X,
-- this exact stay, oldest to newest" — a chart's PricePoint[] comes straight
-- off this index.
create index hotel_price_history_lookup_idx
  on public.hotel_price_history (hotel_id, check_in, check_out, checked_at);

create trigger set_hotel_price_history_updated_at
  before update on public.hotel_price_history
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- price_alerts — a notification that was actually raised for a user, e.g.
-- "target price reached" or "new 30-day low". user_id is denormalized from
-- tracked_hotels so RLS and "내 알림" queries don't need a join.
-- ---------------------------------------------------------------------------
create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  tracked_hotel_id uuid not null references public.tracked_hotels (id) on delete cascade,
  price_history_id bigint references public.hotel_price_history (id) on delete set null,
  alert_type text not null check (alert_type in ('target_reached', 'price_drop', 'new_low')),
  triggered_price numeric(12, 2) not null,
  currency text not null,
  message text,
  is_read boolean not null default false,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index price_alerts_user_id_sent_at_idx on public.price_alerts (user_id, sent_at desc);
create index price_alerts_tracked_hotel_id_idx on public.price_alerts (tracked_hotel_id);
create index price_alerts_user_id_unread_idx on public.price_alerts (user_id) where not is_read;

create trigger set_price_alerts_updated_at
  before update on public.price_alerts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Rule of thumb used below: every table has RLS enabled; personal tables
-- (users, trips, tracked_hotels, price_alerts) restrict every operation to
-- `auth.uid()`; shared catalog/log tables (hotels, hotel_price_history) allow
-- public read but grant no write policy to `anon`/`authenticated` at all —
-- so only the service_role key (which bypasses RLS) can write to them. That
-- key must only ever be used from trusted server code (Next.js Server
-- Actions / Route Handlers / a scheduled price-check job), never shipped to
-- the browser. The browser only ever sees the anon key, whose access is
-- entirely defined by the policies below.
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.hotels enable row level security;
alter table public.trips enable row level security;
alter table public.tracked_hotels enable row level security;
alter table public.hotel_price_history enable row level security;
alter table public.price_alerts enable row level security;

-- users: read/update your own profile only. Insert happens via the
-- on_auth_user_created trigger (security definer), never directly from a
-- client, so there's intentionally no insert policy here.
create policy "users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- hotels: public read (hotel detail pages must stay crawlable/SEO-friendly),
-- no client-side writes — the catalog is only ever populated by trusted
-- server code using the service_role key.
create policy "hotels are publicly readable"
  on public.hotels for select
  using (true);

-- trips: fully owner-restricted CRUD.
create policy "users can view own trips"
  on public.trips for select
  using (auth.uid() = user_id);

create policy "users can insert own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "users can update own trips"
  on public.trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

-- tracked_hotels: fully owner-restricted CRUD.
create policy "users can view own tracked hotels"
  on public.tracked_hotels for select
  using (auth.uid() = user_id);

create policy "users can insert own tracked hotels"
  on public.tracked_hotels for insert
  with check (auth.uid() = user_id);

create policy "users can update own tracked hotels"
  on public.tracked_hotels for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own tracked hotels"
  on public.tracked_hotels for delete
  using (auth.uid() = user_id);

-- hotel_price_history: public read (backs the price graph on public hotel
-- pages), no client-side writes — only a trusted server-side price-checker
-- (service_role) appends rows here.
create policy "price history is publicly readable"
  on public.hotel_price_history for select
  using (true);

-- price_alerts: owners can read, mark read/unread, or dismiss their own
-- alerts. No insert policy — alerts are only ever created server-side
-- (service_role) when a price check detects a trigger condition.
create policy "users can view own price alerts"
  on public.price_alerts for select
  using (auth.uid() = user_id);

create policy "users can update own price alerts"
  on public.price_alerts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own price alerts"
  on public.price_alerts for delete
  using (auth.uid() = user_id);
