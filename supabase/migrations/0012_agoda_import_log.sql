-- Per-user daily cap on the "아고다 링크로 추적하기" import flow
-- (src/lib/hotels/agodaLink/), separate from the global
-- serpapi_call_log (0008) — that one has no user_id, so without this a
-- single user could exhaust the whole day's shared SerpApi budget just by
-- pasting misses. Same shape as 0008's table + function, keyed by
-- (user_id, day) instead of just day.
create table public.agoda_import_log (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  call_count integer not null default 0,
  primary key (user_id, day)
);

-- No RLS policies on purpose — only the admin (service-role) client ever
-- touches this table, from src/lib/supabase/agodaImportLog.ts. Same
-- "enable RLS, grant nothing to anon/authenticated" shape as serpapi_call_log.
alter table public.agoda_import_log enable row level security;

create or replace function public.try_increment_agoda_import_log(p_user_id uuid, limit_count integer)
returns boolean
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into public.agoda_import_log (user_id, day, call_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, day) do update
    set call_count = public.agoda_import_log.call_count + 1
  returning call_count into new_count;

  if new_count > limit_count then
    update public.agoda_import_log
      set call_count = call_count - 1
      where user_id = p_user_id and day = current_date;
    return false;
  end if;

  return true;
end;
$$;
