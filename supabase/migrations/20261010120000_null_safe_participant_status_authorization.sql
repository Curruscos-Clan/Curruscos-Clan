-- Ensure nullable event creators never produce a NULL authorization decision.
-- Validate on a disposable PostgreSQL/Supabase database before deployment.

CREATE OR REPLACE FUNCTION public.set_event_participant_status(target_event_id uuid, target_user_id uuid, target_status text)
 RETURNS public.event_participants
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  e public.events%rowtype;
  existing public.event_participants%rowtype;
  confirmed_count integer;
  can_manage boolean := false;
begin
  if actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if target_status not in ('yes', 'no', 'pending') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into e
  from public.events
  where id = target_event_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  can_manage := coalesce(e.created_by = actor, false) or exists (
    select 1 from public.group_members gm
    where gm.group_id = e.group_id
      and gm.user_id = actor
      and gm.role in ('owner', 'admin')
  );

  if target_user_id is distinct from actor and not can_manage then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not (
    e.visibility in ('public', 'unlisted')
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = e.group_id and gm.user_id = actor
    )
    or can_manage
  ) then
    raise exception 'NO_ACCESS';
  end if;

  select * into existing
  from public.event_participants
  where event_id = e.id and user_id = target_user_id
  for update;

  if target_status = 'yes' and (existing.id is null or existing.status <> 'yes') then
    if e.status <> 'published' then
      raise exception 'EVENT_CLOSED';
    end if;
    if e.registration_deadline is not null and e.registration_deadline < now() then
      raise exception 'REGISTRATION_CLOSED';
    end if;

    select count(*)::integer into confirmed_count
    from public.event_participants
    where event_id = e.id and status = 'yes';

    if e.capacity is not null and confirmed_count >= e.capacity then
      raise exception 'EVENT_FULL';
    end if;
  end if;

  if existing.id is not null then
    update public.event_participants
    set status = target_status
    where id = existing.id
    returning * into existing;
  else
    insert into public.event_participants(event_id, user_id, status)
    values (e.id, target_user_id, target_status)
    returning * into existing;
  end if;

  return existing;
end;
$function$;
