-- Public event registration lifecycle hardening.
-- Apply on a development database first; do not merge to production before UI regression tests.

create or replace function public.join_public_event(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := (select auth.uid());
  e public.events%rowtype;
  existing public.event_participants%rowtype;
  confirmed_count integer;
  event_starts_at timestamptz;
  event_timezone text;
begin
  if actor is null then
    return jsonb_build_object('success', false, 'code', 'NOT_AUTHENTICATED', 'message', 'Necesitas iniciar sesión.');
  end if;

  select * into e
  from public.events
  where id = target_event_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'EVENT_NOT_FOUND', 'message', 'El evento no existe.');
  end if;

  if e.status <> 'published' then
    return jsonb_build_object('success', false, 'code', 'EVENT_CLOSED', 'message', 'Este evento no admite nuevas inscripciones.');
  end if;

  select coalesce(g.timezone, 'Europe/Madrid')
    into event_timezone
  from public.groups g
  where g.id = e.group_id;

  event_timezone := coalesce(event_timezone, 'Europe/Madrid');
  event_starts_at := (e.date + coalesce(e.time, time '00:00')) at time zone event_timezone;

  if event_starts_at <= now() then
    return jsonb_build_object('success', false, 'code', 'EVENT_STARTED', 'message', 'El evento ya ha comenzado y no admite nuevas inscripciones.');
  end if;

  if e.registration_deadline is not null and e.registration_deadline <= now() then
    return jsonb_build_object('success', false, 'code', 'REGISTRATION_CLOSED', 'message', 'Las inscripciones están cerradas.');
  end if;

  if not (
    e.visibility in ('public', 'unlisted')
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = e.group_id and gm.user_id = actor
    )
  ) then
    return jsonb_build_object('success', false, 'code', 'NO_ACCESS', 'message', 'No tienes acceso a este evento.');
  end if;

  select * into existing
  from public.event_participants
  where event_id = e.id and user_id = actor
  for update;

  if found and existing.status = 'yes' then
    return jsonb_build_object(
      'success', true, 'code', 'ALREADY_JOINED',
      'message', 'Ya estás apuntado al evento.',
      'participant_id', existing.id, 'status', existing.status
    );
  end if;

  select count(*)::integer into confirmed_count
  from public.event_participants
  where event_id = e.id and status = 'yes';

  if e.capacity is not null and confirmed_count >= e.capacity then
    return jsonb_build_object('success', false, 'code', 'EVENT_FULL', 'message', 'El evento está completo.');
  end if;

  if existing.id is not null then
    update public.event_participants set status = 'yes'
    where id = existing.id
    returning * into existing;
  else
    insert into public.event_participants(event_id, user_id, status)
    values (e.id, actor, 'yes')
    returning * into existing;
  end if;

  return jsonb_build_object(
    'success', true, 'code', 'JOINED', 'message', 'Inscripción confirmada.',
    'participant_id', existing.id, 'event_id', existing.event_id,
    'user_id', existing.user_id, 'status', existing.status
  );
end;
$function$;

create or replace function public.set_public_event_status(target_event_id uuid, new_status text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  e public.events%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  if new_status not in ('published','preparing','live','finished','cancelled') then
    raise exception 'Estado no válido';
  end if;

  select * into e
  from public.events
  where id = target_event_id
  for update;

  if not found then
    raise exception 'Evento no encontrado';
  end if;

  if not public.is_public_event_organizer(target_event_id) then
    raise exception 'No tienes permisos para gestionar este evento';
  end if;

  if e.status in ('cancelled','finished') and new_status <> e.status then
    raise exception 'No se puede reabrir un evento cancelado o finalizado';
  end if;

  if e.status = 'draft' and new_status not in ('published','cancelled') then
    raise exception 'Un borrador solo puede publicarse o cancelarse';
  end if;

  if e.status = 'published' and new_status not in ('published','preparing','live','finished','cancelled') then
    raise exception 'Transición de estado no válida';
  end if;

  if new_status = 'live'
     and e.format in ('knockout','round_robin','swiss')
     and not exists (select 1 from public.event_matches where event_id = e.id) then
    raise exception 'Genera primero el cuadro o calendario';
  end if;

  if new_status = 'finished'
     and e.format in ('knockout','round_robin','swiss')
     and exists (
       select 1 from public.event_matches
       where event_id = e.id and status in ('scheduled','live')
     ) then
    raise exception 'No puedes finalizar la competición mientras haya partidos pendientes';
  end if;

  update public.events set status = new_status where id = target_event_id;
  return jsonb_build_object('event_id', e.id, 'status', new_status);
end;
$function$;

-- Keep public participant counts working while exposing only confirmed public entries.
-- Users can still see their own row and group members can manage visibility within their group.
drop policy if exists "Authenticated users can view event participation" on public.event_participants;
create policy "Users can view own group or confirmed public participation"
on public.event_participants
for select
to authenticated
using (
  user_id = (select auth.uid())
  -- Organizers must retain access to pending/declined rows for their own events,
  -- including standalone events that do not belong to a group.
  or public.is_public_event_organizer(event_participants.event_id)
  or exists (
    select 1
    from public.events e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = event_participants.event_id
      and gm.user_id = (select auth.uid())
  )
  or (
    status = 'yes'
    and exists (
      select 1
      from public.events e
      where e.id = event_participants.event_id
        and e.visibility = 'public'
        and e.status in ('published','preparing','live','finished')
    )
  )
);

revoke all on function public.join_public_event(uuid) from public, anon;
grant execute on function public.join_public_event(uuid) to authenticated;
revoke all on function public.set_public_event_status(uuid, text) from public, anon;
grant execute on function public.set_public_event_status(uuid, text) to authenticated;
