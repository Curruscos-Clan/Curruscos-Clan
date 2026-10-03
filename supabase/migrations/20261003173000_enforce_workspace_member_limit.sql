create or replace function public.enforce_group_member_plan_limit()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_limit integer; v_count integer;
begin
 select p.max_members into v_limit
 from public.group_subscriptions s join public.workspace_plans p on p.code=s.plan_code
 where s.group_id=new.group_id and s.status in ('trialing','active') limit 1;
 if v_limit is null then select max_members into v_limit from public.workspace_plans where code='free'; end if;
 select count(*) into v_count from public.group_members where group_id=new.group_id;
 if v_limit is not null and v_count >= v_limit then raise exception 'PLAN_LIMIT_MEMBERS'; end if;
 return new;
end;
$$;
revoke all on function public.enforce_group_member_plan_limit() from public,anon,authenticated;
drop trigger if exists enforce_plan_member_limit on public.group_members;
create trigger enforce_plan_member_limit before insert on public.group_members for each row execute function public.enforce_group_member_plan_limit();

create or replace function private.create_group_secure(group_name text, group_description text default null)
returns public.groups language plpgsql security definer
set search_path=pg_catalog,public,auth,pg_temp
as $$
declare new_group public.groups;
begin
 if auth.uid() is null then raise exception 'Usuario no autenticado'; end if;
 if length(trim(coalesce(group_name,'')))=0 then raise exception 'El nombre del grupo es obligatorio'; end if;
 if length(trim(group_name))>80 then raise exception 'El nombre del grupo es demasiado largo'; end if;
 if length(coalesce(group_description,''))>500 then raise exception 'La descripción del grupo es demasiado larga'; end if;
 insert into public.groups(name,description,created_by,slug,timezone,default_locale,visibility)
 values(trim(group_name),nullif(trim(group_description),''),auth.uid(),
 lower(regexp_replace(trim(group_name),'[^a-zA-Z0-9]+','-','g'))||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
 coalesce(auth.jwt()->>'timezone','Europe/Madrid'),coalesce(auth.jwt()->>'locale','es'),'private')
 returning * into new_group;
 insert into public.group_subscriptions(group_id,plan_code,status) values(new_group.id,'free','active') on conflict(group_id) do nothing;
 insert into public.group_members(group_id,user_id,role) values(new_group.id,auth.uid(),'owner');
 return new_group;
end;
$$;