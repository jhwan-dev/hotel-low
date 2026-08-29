-- Kakao login: email is not available without a Kakao "Biz App" review, so
-- public.users.email must accept null, and the signup trigger should fall
-- back to populating display_name from whatever the provider gives us
-- (Kakao's nickname consent item, Google's name, etc).

alter table public.users alter column email drop not null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'nickname',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'preferred_username'
    )
  );
  return new;
end;
$$;
