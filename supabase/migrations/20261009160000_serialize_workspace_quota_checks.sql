create or replace function public.enforce_group_plan_limits()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_plan record;
  v_count integer;
  v_members integer;
begin
  if new.group_id is null then
    raise exception 'GROUP_REQUIRED';
  end if;

  -- Serialize quota checks per workspace so concurrent inserts cannot exceed limits.
  perform pg_advisory_xact_lock(hashtextextended(new.group_id::text, 0));

  if v_user is null or not exists (
    select 1 from public.group_members
    where group_id = new.group_id and user_id = v_user
  ) then
    raise exception 'NOT_GROUP_MEMBER';
  end if;

  select p.code,p.max_members,p.max_events_per_month,p.max_trips
  into v_plan
  from public.group_subscriptions s
  join public.workspace_plans p on p.code = s.plan_code
  where s.group_id = new.group_id and s.status in ('trialing','active')
  limit 1;

  if v_plan.code is null then
    select code,max_members,max_events_per_month,max_trips
    into v_plan from public.workspace_plans where code = 'free';
  end if;

  if tg_table_name='events' and v_plan.max_events_per_month is not null then
    select count(*) into v_count from public.events
    where group_id=new.group_id and created_at >= date_trunc('month',now());
    if v_count >= v_plan.max_events_per_month then raise exception 'PLAN_LIMIT_EVENTS'; end if;
  end if;

  if tg_table_name='trips' and v_plan.max_trips is not null then
    select count(*) into v_count from public.trips where group_id=new.group_id;
    if v_count >= v_plan.max_trips then raise exception 'PLAN_LIMIT_TRIPS'; end if;
  end if;

  return new;
end;
$function$;
