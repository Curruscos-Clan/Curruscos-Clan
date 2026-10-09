create or replace function public.create_encrypted_trip(
  target_group_id uuid,
  trip_start_date date default null,
  trip_end_date date default null,
  trip_budget numeric default null,
  encrypted_payload text default null,
  encryption_version integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  tid uuid;
  v_count integer;
  v_limit integer;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if target_group_id is null then raise exception 'GROUP_REQUIRED'; end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = uid
  ) then
    raise exception 'NO_PERMISSION';
  end if;

  if encrypted_payload is null or btrim(encrypted_payload) = '' then
    raise exception 'ENCRYPTED_PAYLOAD_REQUIRED';
  end if;

  if encryption_version is null or encryption_version < 1 then
    raise exception 'ENCRYPTION_VERSION_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_group_id::text, 0)
  );

  select p.max_trips
  into v_limit
  from public.group_subscriptions s
  join public.workspace_plans p on p.code = s.plan_code
  where s.group_id = target_group_id
    and s.status in ('trialing', 'active')
  limit 1;

  if v_limit is null then
    select max_trips into v_limit
    from public.workspace_plans
    where code = 'free';
  end if;

  select count(*) into v_count
  from public.trips
  where group_id = target_group_id;

  if v_limit is not null and v_count >= v_limit then
    raise exception 'PLAN_LIMIT_TRIPS';
  end if;

  insert into public.trips(
    group_id, created_by, title, destination, start_date, end_date,
    budget_per_person, description, search_preferences,
    encrypted_payload, encryption_version
  )
  values (
    target_group_id, uid, null, null, trip_start_date, trip_end_date,
    trip_budget, null, '{}'::jsonb, encrypted_payload, encryption_version
  )
  returning id into tid;

  return tid;
end;
$function$;
