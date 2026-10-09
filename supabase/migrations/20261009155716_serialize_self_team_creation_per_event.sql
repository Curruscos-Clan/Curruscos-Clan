create or replace function public.create_event_team_for_self(target_event_id uuid, team_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  team_id uuid;
  clean_name text := trim(team_name);
  e public.events%rowtype;
begin
  if actor is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  select * into e
  from public.events
  where id = target_event_id
  for update;

  if not found then
    raise exception 'Evento no encontrado';
  end if;

  if e.participant_mode <> 'team' then
    raise exception 'Este evento no utiliza equipos';
  end if;

  if e.status <> 'published' then
    raise exception 'El evento no admite nuevas inscripciones';
  end if;

  if e.registration_deadline is not null and e.registration_deadline < now() then
    raise exception 'Las inscripciones están cerradas';
  end if;

  if not exists (
    select 1
    from public.event_participants
    where event_id = e.id
      and user_id = actor
      and status = 'yes'
  ) then
    raise exception 'Primero debes inscribirte en el evento';
  end if;

  if exists (
    select 1
    from public.event_team_members etm
    join public.event_teams t on t.id = etm.team_id
    where t.event_id = e.id
      and etm.user_id = actor
  ) then
    raise exception 'Ya perteneces a un equipo en este evento';
  end if;

  if clean_name = '' or char_length(clean_name) > 80 then
    raise exception 'El nombre del equipo no es válido';
  end if;

  insert into public.event_teams(event_id, name)
  values (target_event_id, clean_name)
  returning id into team_id;

  insert into public.event_team_members(team_id, user_id)
  values (team_id, actor);

  return team_id;
end;
$function$;
