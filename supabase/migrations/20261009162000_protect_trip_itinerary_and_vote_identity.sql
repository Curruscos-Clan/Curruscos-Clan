-- Prevent trip itinerary rows and votes from being reassigned or impersonated.
-- These identity fields remain immutable even if broader update policies change.

create or replace function public.prevent_trip_itinerary_identity_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.trip_id is distinct from old.trip_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Trip itinerary item identity fields cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_trip_itinerary_identity_changes() from public, anon, authenticated;

drop trigger if exists protect_trip_itinerary_identity on public.trip_itinerary_items;
create trigger protect_trip_itinerary_identity
before update on public.trip_itinerary_items
for each row execute function public.prevent_trip_itinerary_identity_changes();

create or replace function public.prevent_trip_vote_identity_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.option_id is distinct from old.option_id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Trip vote identity fields cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_trip_vote_identity_changes() from public, anon, authenticated;

drop trigger if exists protect_trip_vote_identity on public.trip_votes;
create trigger protect_trip_vote_identity
before update on public.trip_votes
for each row execute function public.prevent_trip_vote_identity_changes();
