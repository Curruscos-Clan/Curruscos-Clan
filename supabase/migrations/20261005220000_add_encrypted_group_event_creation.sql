-- Create group events with client-side E2EE payloads.
create or replace function public.create_encrypted_group_event(
  target_group_id uuid,
  event_date date default null,
  event_time time default null,
  event_trip_id uuid default null,
  encrypted_payload text default null,
  encryption_version integer default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  eid uuid;
  v_count integer;
  v_limit integer;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if target_group_id is null then raise exception 'GROUP_REQUIRED'; end if;
  if encrypted_payload is null or btrim(encrypted_payload) = '' then raise exception 'ENCRYPTED_PAYLOAD_REQUIRED'; end if;
  if encryption_version is null or encryption_version < 1 then raise exception 'ENCRYPTION_VERSION_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_group_id::text, 0));
  if not exists (select 1 from public.group_members where group_id = target_group_id and user_id = uid) then raise exception 'NO_PERMISSION'; end if;
  select p.max_events_per_month into v_limit from public.group_subscriptions s join public.workspace_plans p on p.code = s.plan_code where s.group_id = target_group_id and s.status in ('trialing','active') limit 1;
  if v_limit is null then select max_events_per_month into v_limit from public.workspace_plans where code = 'free'; end if;
  select count(*) into v_count from public.events where group_id = target_group_id and created_at >= date_trunc('month', now());
  if v_limit is not null and v_count >= v_limit then raise exception 'PLAN_LIMIT_EVENTS'; end if;
  insert into public.events(group_id,created_by,title,description,date,time,location,trip_id,encrypted_payload,encryption_version)
  values(target_group_id,uid,null,null,event_date,event_time,null,event_trip_id,encrypted_payload,encryption_version)
  returning id into eid;
  return eid;
end;
$function$;
revoke execute on function public.create_encrypted_group_event(uuid,date,time,uuid,text,integer) from public;
revoke execute on function public.create_encrypted_group_event(uuid,date,time,uuid,text,integer) from anon;
grant execute on function public.create_encrypted_group_event(uuid,date,time,uuid,text,integer) to authenticated;
