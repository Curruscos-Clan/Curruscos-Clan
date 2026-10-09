-- Fix the new-participant branch in join_public_event.
-- FOUND was overwritten by SELECT count(*), which always returns one row.
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
begin
  if actor is null then
    return jsonb_build_object('success', false, 'code', 'NOT_AUTHENTICATED', 'message', 'Necesitas iniciar sesión.');
  end if;

  select *
  into e
  from public.events
  where id = target_event_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'EVENT_NOT_FOUND', 'message', 'El evento no existe.');
  end if;

  if e.status <> 'published' then
    return jsonb_build_object('success', false, 'code', 'EVENT_CLOSED', 'message', 'Este evento no admite nuevas inscripciones.');
  end if;

  if e.registration_deadline is not null and e.registration_deadline < now() then
    return jsonb_build_object('success', false, 'code', 'REGISTRATION_CLOSED', 'message', 'Las inscripciones están cerradas.');
  end if;

  if not (
    e.visibility in ('public', 'unlisted')
    or exists (
      select 1
      from public.group_members gm
      where gm.group_id = e.group_id
        and gm.user_id = actor
    )
  ) then
    return jsonb_build_object('success', false, 'code', 'NO_ACCESS', 'message', 'No tienes acceso a este evento.');
  end if;

  select *
  into existing
  from public.event_participants
  where event_id = e.id
    and user_id = actor
  for update;

  if found and existing.status = 'yes' then
    return jsonb_build_object(
      'success', true,
      'code', 'ALREADY_JOINED',
      'message', 'Ya estás apuntado al evento.',
      'participant_id', existing.id,
      'status', existing.status
    );
  end if;

  select count(*)::integer
  into confirmed_count
  from public.event_participants
  where event_id = e.id
    and status = 'yes';

  if e.capacity is not null and confirmed_count >= e.capacity then
    return jsonb_build_object(
      'success', false,
      'code', 'EVENT_FULL',
      'message', 'El evento está completo.'
    );
  end if;

  if existing.id is not null then
    update public.event_participants
    set status = 'yes'
    where id = existing.id
    returning * into existing;
  else
    insert into public.event_participants(event_id, user_id, status)
    values (e.id, actor, 'yes')
    returning * into existing;
  end if;

  return jsonb_build_object(
    'success', true,
    'code', 'JOINED',
    'message', 'Inscripción confirmada.',
    'participant_id', existing.id,
    'event_id', existing.event_id,
    'user_id', existing.user_id,
    'status', existing.status
  );
end;
$function$;
