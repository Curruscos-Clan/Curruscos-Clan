create or replace function private.create_group_event_secure(
  event_title text,
  event_description text default null,
  event_date date default null,
  event_time time without time zone default null,
  event_location text default null,
  event_trip_id uuid default null
)
returns public.events
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  gid uuid;
  new_event public.events;
  v_count integer;
  v_limit integer;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select gm.group_id into gid
  from public.group_members gm
  where gm.user_id = uid
  order by case when gm.role = 'owner' then 0 when gm.role = 'admin' then 1 else 2 end
  limit 1;

  if gid is null then raise exception 'NO_GROUP'; end if;

  -- Serialize legacy event creation quota checks per group.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(gid::text, 0));

  if not exists (
    select 1 from public.group_members
    where group_id = gid and user_id = uid
  ) then raise exception 'NO_PERMISSION'; end if;

  select p.max_events_per_month into v_limit
  from public.group_subscriptions s
  join public.workspace_plans p on p.code = s.plan_code
  where s.group_id = gid and s.status in ('trialing','active')
  limit 1;

  if v_limit is null then
    select max_events_per_month into v_limit
    from public.workspace_plans where code = 'free';
  end if;

  select count(*) into v_count
  from public.events
  where group_id = gid
    and created_at >= date_trunc('month', now());

  if v_limit is not null and v_count >= v_limit then
    raise exception 'PLAN_LIMIT_EVENTS';
  end if;

  insert into public.events(
    group_id, created_by, title, description, date, time, location, trip_id
  ) values (
    gid, uid, left(trim(coalesce(event_title,'')),120),
    nullif(trim(event_description),''), event_date, event_time,
    nullif(trim(event_location),''), event_trip_id
  )
  returning * into new_event;

  return new_event;
end;
$function$;
