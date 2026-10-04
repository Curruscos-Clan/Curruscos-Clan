-- Enforce event/trip plan limits atomically.
-- The per-workspace advisory lock closes the TOCTOU race where concurrent
-- creates could both observe capacity and exceed the plan.

drop function if exists private.create_group_event_secure(uuid,text,text,date,time without time zone,text,uuid);
create function private.create_group_event_secure(target_group_id uuid,event_title text,event_description text,event_date date,event_time time without time zone,event_location text,event_trip_id uuid)
returns public.events language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); new_event public.events; v_count integer; v_limit integer;
begin
 if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if target_group_id is null then raise exception 'GROUP_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_group_id::text,0));
 if not exists(select 1 from public.group_members where group_id=target_group_id and user_id=uid) then raise exception 'NO_PERMISSION'; end if;
 select p.max_events_per_month into v_limit from public.group_subscriptions s join public.workspace_plans p on p.code=s.plan_code where s.group_id=target_group_id and s.status in ('trialing','active') limit 1;
 if v_limit is null then select max_events_per_month into v_limit from public.workspace_plans where code='free'; end if;
 select count(*) into v_count from public.events where group_id=target_group_id and created_at>=date_trunc('month',now());
 if v_limit is not null and v_count>=v_limit then raise exception 'PLAN_LIMIT_EVENTS'; end if;
 insert into public.events(group_id,created_by,title,description,date,time,location,trip_id)
 values(target_group_id,uid,left(trim(coalesce(event_title,'')),120),nullif(trim(event_description),''),event_date,event_time,nullif(trim(event_location),''),event_trip_id)
 returning * into new_event;
 return new_event;
end; $$;

create or replace function private.create_trip_secure(target_group_id uuid,trip_title text,trip_destination text default null,trip_start_date date default null,trip_end_date date default null,trip_budget numeric default null,trip_description text default null,trip_search_preferences jsonb default '{}'::jsonb)
returns public.trips language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); result_row public.trips; v_count integer; v_limit integer;
begin
 if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_group_id::text,0));
 if not exists(select 1 from public.group_members where group_id=target_group_id and user_id=uid and role in ('owner','admin')) then raise exception 'NO_PERMISSION'; end if;
 select p.max_trips into v_limit from public.group_subscriptions s join public.workspace_plans p on p.code=s.plan_code where s.group_id=target_group_id and s.status in ('trialing','active') limit 1;
 if v_limit is null then select max_trips into v_limit from public.workspace_plans where code='free'; end if;
 select count(*) into v_count from public.trips where group_id=target_group_id;
 if v_limit is not null and v_count>=v_limit then raise exception 'PLAN_LIMIT_TRIPS'; end if;
 insert into public.trips(group_id,created_by,title,destination,start_date,end_date,budget_per_person,description,search_preferences)
 values(target_group_id,uid,left(trim(coalesce(trip_title,'')),120),nullif(trim(trip_destination),''),trip_start_date,trip_end_date,trip_budget,nullif(trim(trip_description),''),coalesce(trip_search_preferences,'{}'::jsonb))
 returning * into result_row;
 return result_row;
end; $$;
revoke all on function private.create_group_event_secure(uuid,text,text,date,time without time zone,text,uuid) from public,anon,authenticated;
revoke all on function private.create_trip_secure(uuid,text,text,date,date,numeric,text,jsonb) from public,anon,authenticated;