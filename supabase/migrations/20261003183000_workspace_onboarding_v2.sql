alter table public.groups add column if not exists workspace_type text not null default 'community';
alter table public.groups add column if not exists onboarding_profile jsonb not null default '{}'::jsonb;
alter table public.groups drop constraint if exists groups_workspace_type_check;
alter table public.groups add constraint groups_workspace_type_check check (workspace_type in ('community','sports','travel','study','organization','other'));

create or replace function private.create_group_secure(group_name text, group_description text default null, group_type text default 'community', group_size text default 'small', group_objective text default null)
returns public.groups language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp
as $$
declare new_group public.groups; v_type text:=lower(trim(coalesce(group_type,'community')));
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if length(trim(coalesce(group_name,'')))=0 then raise exception 'GROUP_NAME_REQUIRED'; end if;
 if length(trim(group_name))>80 then raise exception 'GROUP_NAME_TOO_LONG'; end if;
 if length(coalesce(group_description,''))>500 then raise exception 'GROUP_DESCRIPTION_TOO_LONG'; end if;
 if v_type not in ('community','sports','travel','study','organization','other') then v_type:='community'; end if;
 insert into public.groups(name,description,created_by,slug,timezone,default_locale,visibility,workspace_type,onboarding_profile)
 values(trim(group_name),nullif(trim(group_description),''),auth.uid(),
 lower(regexp_replace(trim(group_name),'[^a-zA-Z0-9]+','-','g'))||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
 coalesce(auth.jwt()->>'timezone','Europe/Madrid'),coalesce(auth.jwt()->>'locale','es'),'private',v_type,
 jsonb_build_object('size',coalesce(nullif(trim(group_size),''),'small'),'objective',nullif(trim(group_objective),''),'completed_at',now()))
 returning * into new_group;
 insert into public.group_subscriptions(group_id,plan_code,status) values(new_group.id,'free','active') on conflict(group_id) do nothing;
 insert into public.group_members(group_id,user_id,role) values(new_group.id,auth.uid(),'owner');
 return new_group;
end;
$$;

create or replace function public.create_group(group_name text, group_description text default null, group_type text default 'community', group_size text default 'small', group_objective text default null)
returns public.groups language sql security invoker set search_path=pg_catalog,public,auth,pg_temp
as $$ select private.create_group_secure($1,$2,$3,$4,$5); $$;
revoke all on function public.create_group(text,text) from public,anon;
revoke all on function public.create_group(text,text,text,text,text) from public,anon;
grant execute on function public.create_group(text,text) to authenticated;
grant execute on function public.create_group(text,text,text,text,text) to authenticated;