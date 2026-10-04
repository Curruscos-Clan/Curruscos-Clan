-- Harden workspace mutation SECURITY DEFINER helpers.
-- Owner-only update/delete, member-only leave, authenticated creation,
-- empty search_path, explicit public qualification, and transactional locking.

drop function if exists private.delete_group_secure(uuid);
drop function if exists private.leave_group_secure(uuid);
drop function if exists private.update_group_secure(uuid,text,text);
drop function if exists private.create_group_secure(text,text);

create function private.delete_group_secure(target_group_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare current_role text;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_group_id::text,0));
 select role into current_role from public.group_members where group_id=target_group_id and user_id=auth.uid() for update;
 if current_role is null then raise exception 'GROUP_MEMBERSHIP_REQUIRED'; end if;
 if current_role <> 'owner' then raise exception 'OWNER_REQUIRED'; end if;
 delete from public.groups where id=target_group_id;
 if not found then raise exception 'GROUP_NOT_FOUND'; end if;
 return true;
end;
$$;

create function private.leave_group_secure(target_group_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare current_member public.group_members;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 select * into current_member from public.group_members where group_id=target_group_id and user_id=auth.uid() for update;
 if current_member.id is null then raise exception 'GROUP_MEMBERSHIP_REQUIRED'; end if;
 if current_member.role='owner' then raise exception 'OWNER_CANNOT_LEAVE'; end if;
 delete from public.group_members where id=current_member.id;
 return true;
end;
$$;

create function private.update_group_secure(target_group_id uuid,new_name text,new_description text)
returns public.groups language plpgsql security definer set search_path=''
as $$
declare current_member public.group_members; updated_group public.groups;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 select * into current_member from public.group_members where group_id=target_group_id and user_id=auth.uid() for update;
 if current_member.id is null then raise exception 'GROUP_MEMBERSHIP_REQUIRED'; end if;
 if current_member.role<>'owner' then raise exception 'OWNER_REQUIRED'; end if;
 if length(trim(coalesce(new_name,'')))=0 then raise exception 'GROUP_NAME_REQUIRED'; end if;
 if length(trim(new_name))>80 then raise exception 'GROUP_NAME_TOO_LONG'; end if;
 if length(coalesce(new_description,''))>500 then raise exception 'GROUP_DESCRIPTION_TOO_LONG'; end if;
 update public.groups set name=trim(new_name),description=nullif(trim(new_description),'') where id=target_group_id returning * into updated_group;
 if updated_group.id is null then raise exception 'GROUP_NOT_FOUND'; end if;
 return updated_group;
end;
$$;

create function private.create_group_secure(group_name text,group_description text)
returns public.groups language plpgsql security definer set search_path=''
as $$
declare new_group public.groups;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if length(trim(coalesce(group_name,'')))=0 then raise exception 'GROUP_NAME_REQUIRED'; end if;
 if length(trim(group_name))>80 then raise exception 'GROUP_NAME_TOO_LONG'; end if;
 if length(coalesce(group_description,''))>500 then raise exception 'GROUP_DESCRIPTION_TOO_LONG'; end if;
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

revoke all on function private.delete_group_secure(uuid) from public,anon,authenticated;
revoke all on function private.leave_group_secure(uuid) from public,anon,authenticated;
revoke all on function private.update_group_secure(uuid,text,text) from public,anon,authenticated;
revoke all on function private.create_group_secure(text,text) from public,anon,authenticated;