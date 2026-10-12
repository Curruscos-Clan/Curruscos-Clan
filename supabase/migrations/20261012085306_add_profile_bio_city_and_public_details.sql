-- Curruscos profile extension: persistent optional bio/location and safe public presentation.
-- Keep this additive: the current profiles contract (display_name, username, avatar_url) remains intact.
alter table public.profiles
  add column if not exists bio text,
  add column if not exists city text;

alter table public.profiles
  drop constraint if exists profiles_bio_length_check,
  drop constraint if exists profiles_city_length_check;

alter table public.profiles
  add constraint profiles_bio_length_check
    check (bio is null or char_length(btrim(bio)) <= 280),
  add constraint profiles_city_length_check
    check (city is null or char_length(btrim(city)) <= 80);

comment on column public.profiles.bio is
  'Optional public-facing biography; only returned by the guarded public profile details RPC.';
comment on column public.profiles.city is
  'Optional profile location. Kept out of the public profile RPC for privacy.';

-- Do not change get_public_profile's established return type. This separate RPC adds
-- optional public-facing details only for people who already qualify for a public profile.
create or replace function public.get_public_profile_details(target_user_id uuid)
returns table(
  user_id uuid,
  bio text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select p.id, p.bio, p.avatar_url
  from public.profiles p
  where p.id = target_user_id
    and exists (
      select 1
      from public.get_public_profile(target_user_id) public_profile
      where public_profile.user_id = p.id
    );
$function$;

revoke all on function public.get_public_profile_details(uuid) from public;
grant execute on function public.get_public_profile_details(uuid) to anon, authenticated;
