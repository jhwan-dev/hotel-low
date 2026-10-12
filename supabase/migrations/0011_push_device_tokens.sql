-- device_tokens — one row per FCM-registered device, feeding the native push
-- swap point in src/lib/notifications/service.ts (PushNotificationService).
-- Same ownership pattern as tracked_hotels: fully owner-restricted CRUD via
-- RLS, no admin-client bypass needed since every write happens from a
-- signed-in user's own session (src/lib/notifications/deviceTokens/actions.ts).
--
-- fcm_token is globally unique rather than unique per user: a device that
-- gets reused under a different account (shared/resold phone, or a user who
-- signs out and a different user signs in on the same app install) must
-- repoint the existing row at the new user_id, never end up with two rows
-- racing for the same token.
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  fcm_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index device_tokens_user_id_idx on public.device_tokens (user_id);

create trigger set_device_tokens_updated_at
  before update on public.device_tokens
  for each row execute function public.set_updated_at();

alter table public.device_tokens enable row level security;

create policy "users can view own device tokens"
  on public.device_tokens for select
  using (auth.uid() = user_id);

create policy "users can insert own device tokens"
  on public.device_tokens for insert
  with check (auth.uid() = user_id);

create policy "users can update own device tokens"
  on public.device_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own device tokens"
  on public.device_tokens for delete
  using (auth.uid() = user_id);
