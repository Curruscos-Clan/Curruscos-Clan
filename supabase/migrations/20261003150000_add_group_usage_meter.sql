create or replace function public.get_group_usage(target_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_member_count integer;
  v_event_count integer;
  v_trip_count integer;
  v_plan record;
  v_period_start timestamptz := date_trunc('month', now());
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.group_members
    where group_id = target_group_id and user_id = v_user
  ) then raise exception 'Not a group member'; end if;

  select p.code,p.name,p.max_members,p.max_events_per_month,p.max_trips,p.max_storage_mb,p.features
  into v_plan
  from public.group_subscriptions s
  join public.workspace_plans p on p.code=s.plan_code
  where s.group_id=target_group_id and s.status in ('trialing','active')
  limit 1;

  if v_plan.code is null then
    select code,name,max_members,max_events_per_month,max_trips,max_storage_mb,features
    into v_plan
    from public.workspace_plans where code='free';
  end if;

  select count(*)::int into v_member_count from public.group_members where group_id=target_group_id;
  select count(*)::int into v_event_count from public.events where group_id=target_group_id and created_at>=v_period_start;
  select count(*)::int into v_trip_count from public.trips where group_id=target_group_id;

  return jsonb_build_object(
    'group_id',target_group_id,
    'period_start',v_period_start,
    'plan',jsonb_build_object(
      'code',v_plan.code,'name',v_plan.name,
      'max_members',v_plan.max_members,
      'max_events_per_month',v_plan.max_events_per_month,
      'max_trips',v_plan.max_trips,
      'max_storage_mb',v_plan.max_storage_mb,
      'features',coalesce(v_plan.features,'{}'::jsonb)
    ),
    'usage',jsonb_build_object(
      'members',v_member_count,
      'events_this_month',v_event_count,
      'trips',v_trip_count
    )
  );
end;
$$;

revoke all on function public.get_group_usage(uuid) from public,anon;
grant execute on function public.get_group_usage(uuid) to authenticated;
