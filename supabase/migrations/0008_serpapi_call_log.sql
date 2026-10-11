-- Hard cap on real SerpApi calls per day (free plan: 250/month), shared by
-- the cron price-check job and tracking-start's one-time live lookup — see
-- src/lib/serpapi/callBudget.ts. One row per day. try_increment_... is the
-- only way either caller is allowed to spend from the budget: the check
-- and the spend are the same atomic upsert, so concurrent cron ticks and
-- tracking-start requests can't race past the limit.
create table public.serpapi_call_log (
  day date primary key,
  call_count integer not null default 0
);

-- No RLS policies on purpose — only the admin (service-role) client ever
-- touches this table, from src/lib/serpapi/callBudget.ts. Same "enable RLS,
-- grant nothing to anon/authenticated" shape as every other table here.
alter table public.serpapi_call_log enable row level security;

create or replace function public.try_increment_serpapi_call_log(limit_count integer)
returns boolean
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into public.serpapi_call_log (day, call_count)
  values (current_date, 1)
  on conflict (day) do update
    set call_count = public.serpapi_call_log.call_count + 1
  returning call_count into new_count;

  if new_count > limit_count then
    update public.serpapi_call_log
      set call_count = call_count - 1
      where day = current_date;
    return false;
  end if;

  return true;
end;
$$;
