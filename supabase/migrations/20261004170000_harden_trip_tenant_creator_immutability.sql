-- Prevent direct trip ownership or workspace reassignment.
-- Trip updates may edit mutable travel fields, but group_id and created_by are immutable.

create or replace function public.protect_trip_tenant_creator_changes()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'public', 'auth', 'pg_temp'
as $function$
begin
  if new.group_id is distinct from old.group_id then
    raise exception 'El grupo de un viaje no se puede cambiar';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'El creador de un viaje no se puede cambiar';
  end if;

  return new;
end;
$function$;

drop trigger if exists protect_trips_tenant_creator on public.trips;

create trigger protect_trips_tenant_creator
before update on public.trips
for each row
execute function public.protect_trip_tenant_creator_changes();
