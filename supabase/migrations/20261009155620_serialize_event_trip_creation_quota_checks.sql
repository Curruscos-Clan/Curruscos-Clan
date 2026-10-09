create or replace function public.create_trip_for_event(target_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  e public.events%rowtype;
  gid uuid;
  tid uuid;
  v_count integer;
  v_limit integer;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into e
  from public.events
  where id = target_event_id
  for update;

  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  gid := e.group_id;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = gid
      and gm.user_id = uid
      and gm.role in ('owner', 'admin')
  ) and e.created_by <> uid then
    raise exception 'NO_PERMISSION';
  end if;

  if e.trip_id is not null then
    return e.trip_id;
  end if;

  if gid is null then
    raise exception 'EVENT_NOT_IN_GROUP';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(gid::text, 0)
  );

  select p.max_trips
  into v_limit
  from public.group_subscriptions s
  join public.workspace_plans p on p.code = s.plan_code
  where s.group_id = gid
    and s.status in ('trialing', 'active')
  limit 1;

  if v_limit is null then
    select max_trips into v_limit
    from public.workspace_plans
    where code = 'free';
  end if;

  select count(*) into v_count
  from public.trips
  where group_id = gid;

  if v_limit is not null and v_count >= v_limit then
    raise exception 'PLAN_LIMIT_TRIPS';
  end if;

  insert into public.trips(
    group_id, created_by, title, destination, start_date, end_date, status, description
  )
  values (
    gid, uid, null, null, e.date, e.date, 'planning', null
  )
  returning id into tid;

  update public.events
  set trip_id = tid
  where id = e.id and trip_id is null;

  insert into public.trip_participants(trip_id, user_id, status, updated_at)
  select tid, ep.user_id,
         case when ep.status = 'yes' then 'confirmed' else 'declined' end,
         now()
  from public.event_participants ep
  where ep.event_id = e.id and ep.status in ('yes', 'no')
  on conflict (trip_id, user_id)
  do update set status = excluded.status, updated_at = now();

  return tid;
end;
$function$;
