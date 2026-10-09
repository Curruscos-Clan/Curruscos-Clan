create or replace function public.enforce_group_member_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_limit integer;
  v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.group_id::text, 0)
  );

  select p.max_members into v_limit
  from public.group_subscriptions s
  join public.workspace_plans p on p.code=s.plan_code
  where s.group_id=new.group_id
    and s.status in ('trialing','active')
  limit 1;

  if v_limit is null then
    select max_members into v_limit
    from public.workspace_plans
    where code='free';
  end if;

  select count(*) into v_count
  from public.group_members
  where group_id=new.group_id;

  if v_limit is not null and v_count >= v_limit then
    raise exception 'PLAN_LIMIT_MEMBERS';
  end if;

  return new;
end;
$function$;
