-- Prevent trip records from being reassigned to another group or creator.
create or replace function public.prevent_trip_identity_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.group_id is distinct from old.group_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Trip identity and group cannot be changed';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_trip_identity_changes() from public, anon, authenticated;

drop trigger if exists trg_prevent_trip_identity_changes on public.trips;
create trigger trg_prevent_trip_identity_changes
before update on public.trips
for each row
execute function public.prevent_trip_identity_changes();
