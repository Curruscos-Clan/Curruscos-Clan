-- Harden event mutation boundaries.
-- An event cannot be moved between workspaces or have its creator changed.
-- If it references a trip, that trip must belong to the same workspace.

create or replace function public.protect_event_identity_changes()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'public', 'auth', 'pg_temp'
as $function$
begin
  if new.group_id is distinct from old.group_id then
    raise exception 'El grupo del evento no se puede cambiar';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'El creador del evento no se puede cambiar';
  end if;

  if new.trip_id is not null then
    if not exists (
      select 1
      from public.trips t
      where t.id = new.trip_id
        and t.group_id = new.group_id
    ) then
      raise exception 'El viaje asociado debe pertenecer al mismo grupo';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists protect_events_identity on public.events;
create trigger protect_events_identity
before update on public.events
for each row execute function public.protect_event_identity_changes();
