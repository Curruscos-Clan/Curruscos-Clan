create or replace function public.protect_event_team_identity_changes()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if new.event_id is distinct from old.event_id then
    raise exception 'El evento del equipo no se puede cambiar';
  end if;
  if new.persistent_team_id is distinct from old.persistent_team_id then
    raise exception 'El equipo persistente asociado no se puede cambiar';
  end if;
  return new;
end;
$function$;

create or replace function private.prevent_event_team_identity_changes()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if new.event_id is distinct from old.event_id then
    raise exception 'EVENT_TEAM_EVENT_IMMUTABLE';
  end if;
  if new.persistent_team_id is distinct from old.persistent_team_id then
    raise exception 'EVENT_TEAM_PERSISTENT_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$function$;
