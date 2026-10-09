-- Close the direct INSERT/UPDATE bypass for event team membership.
-- Keep team management available to event creators and group admins through the validated RPC.
create or replace function public.add_event_team_member(target_team_id uuid, target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  team_event_id uuid;
  e public.events%rowtype;
begin
  if actor is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  select et.event_id into team_event_id
  from public.event_teams et
  where et.id = target_team_id;

  if team_event_id is null then
    raise exception 'Equipo no encontrado';
  end if;

  -- Serialize team membership changes for this event before trigger validation.
  select * into e
  from public.events
  where id = team_event_id
  for update;

  if not found then
    raise exception 'Evento no encontrado';
  end if;

  if not exists (
    select 1 from public.event_teams et
    where et.id = target_team_id and et.event_id = e.id
  ) then
    raise exception 'Equipo no encontrado';
  end if;

  if e.created_by <> actor and not exists (
    select 1
    from public.group_members gm
    where gm.group_id = e.group_id
      and gm.user_id = actor
      and gm.role in ('owner', 'admin')
  ) then
    raise exception 'No tienes permisos para gestionar este equipo';
  end if;

  if e.participant_mode <> 'team' then
    raise exception 'Este evento usa participantes individuales';
  end if;

  if not exists (
    select 1 from public.event_participants ep
    where ep.event_id = e.id
      and ep.user_id = target_user_id
      and ep.status = 'yes'
  ) then
    raise exception 'El jugador debe estar inscrito en el evento';
  end if;

  insert into public.event_team_members(team_id, user_id)
  values (target_team_id, target_user_id)
  on conflict (team_id, user_id) do nothing;

  return jsonb_build_object('team_id', target_team_id, 'user_id', target_user_id);
end;
$function$;

drop policy if exists "Event creator or group admin manages team members"
  on public.event_team_members;

-- Membership rows are created/deleted by validated RPCs; no ordinary UPDATE is needed.
drop policy if exists "Event creator or group admin updates team members"
  on public.event_team_members;
