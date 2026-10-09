-- Ensure an event participant cannot be assigned to multiple event teams.
-- Both paths lock the event row, so this check is serialized with self-team creation
-- and other team membership RPCs.

create or replace function public.add_event_team_member(target_team_id uuid, target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
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

  if exists (
    select 1
    from public.event_team_members etm
    join public.event_teams et on et.id = etm.team_id
    where et.event_id = e.id
      and etm.user_id = target_user_id
      and etm.team_id <> target_team_id
  ) then
    raise exception 'El jugador ya pertenece a otro equipo en este evento';
  end if;

  insert into public.event_team_members(team_id, user_id)
  values (target_team_id, target_user_id)
  on conflict (team_id, user_id) do nothing;

  return jsonb_build_object('team_id', target_team_id, 'user_id', target_user_id);
end;
$function$;

create or replace function public.respond_to_invitation(target_invitation_id uuid, accept boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  inv public.invitations%rowtype;
  e public.events%rowtype;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  select * into inv
  from public.invitations
  where id = target_invitation_id
    and invitee_id = uid
    and status = 'pending'
  for update;

  if not found then
    raise exception 'invitation not found';
  end if;

  if accept then
    if inv.kind = 'group' then
      if not exists(select 1 from public.groups where id = inv.group_id) then
        raise exception 'group not found';
      end if;
      insert into public.group_members(group_id, user_id, role)
      values(inv.group_id, uid, 'member')
      on conflict(group_id, user_id) do nothing;

    elsif inv.kind = 'event' then
      select * into e
      from public.events
      where id = inv.event_id
      for update;

      if not found then
        raise exception 'event not found';
      end if;
      if e.status in ('cancelled', 'finished') then
        raise exception 'event is not accepting participants';
      end if;
      if e.registration_deadline is not null and now() > e.registration_deadline then
        raise exception 'registration closed';
      end if;
      if e.capacity is not null and e.capacity > 0
         and (select count(*) from public.event_participants where event_id = e.id and status = 'yes') >= e.capacity
         and not exists(select 1 from public.event_participants where event_id = e.id and user_id = uid and status = 'yes') then
        raise exception 'event is full';
      end if;

      insert into public.event_participants(event_id, user_id, status)
      values(e.id, uid, 'yes')
      on conflict(event_id, user_id) do update set status = 'yes';

    elsif inv.kind = 'team' then
      if exists(select 1 from public.teams where id = inv.team_id) then
        insert into public.team_members(team_id, user_id, role)
        values(inv.team_id, uid, 'member')
        on conflict(team_id, user_id) do nothing;

      else
        select ev.* into e
        from public.events ev
        join public.event_teams et on et.event_id = ev.id
        where et.id = inv.team_id
        for update of ev;

        if not found then
          raise exception 'team not found';
        end if;
        if e.participant_mode <> 'team' or e.status <> 'published' then
          raise exception 'event team is not accepting members';
        end if;
        if e.registration_deadline is not null and now() > e.registration_deadline then
          raise exception 'registration closed';
        end if;
        if not exists(
          select 1 from public.event_participants ep
          where ep.event_id = e.id and ep.user_id = uid and ep.status = 'yes'
        ) then
          raise exception 'Join the event before accepting a team invitation';
        end if;

        if exists (
          select 1
          from public.event_team_members etm
          join public.event_teams et on et.id = etm.team_id
          where et.event_id = e.id
            and etm.user_id = uid
            and etm.team_id <> inv.team_id
        ) then
          raise exception 'You already belong to another team in this event';
        end if;

        if not exists(
          select 1 from public.event_team_members
          where team_id = inv.team_id and user_id = uid
        ) then
          insert into public.event_team_members(team_id, user_id)
          values(inv.team_id, uid);
        end if;
      end if;
    end if;
  end if;

  update public.invitations
  set status = case when accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = target_invitation_id;

  return true;
end;
$function$;
