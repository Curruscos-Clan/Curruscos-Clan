-- Keep event team identity immutable after creation.
-- Team membership identity is also immutable; membership operations should use
-- dedicated RPCs instead of moving an existing row between teams/users.

create or replace function public.protect_event_team_identity_changes()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'public', 'auth', 'pg_temp'
as $function$
begin
  if new.event_id is distinct from old.event_id then
    raise exception 'El evento del equipo no se puede cambiar';
  end if;
  return new;
end;
$function$;

drop trigger if exists protect_event_team_identity on public.event_teams;
create trigger protect_event_team_identity
before update on public.event_teams
for each row execute function public.protect_event_team_identity_changes();

create or replace function public.protect_event_team_member_identity_changes()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'public', 'auth', 'pg_temp'
as $function$
begin
  if new.team_id is distinct from old.team_id then
    raise exception 'El equipo del miembro no se puede cambiar';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'El usuario del miembro no se puede cambiar';
  end if;
  return new;
end;
$function$;

drop trigger if exists protect_event_team_member_identity on public.event_team_members;
create trigger protect_event_team_member_identity
before update on public.event_team_members
for each row execute function public.protect_event_team_member_identity_changes();
