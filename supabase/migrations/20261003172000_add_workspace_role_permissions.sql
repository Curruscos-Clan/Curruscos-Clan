create or replace function public.is_group_admin(target_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
 select exists(select 1 from public.group_members where group_id=target_group_id and user_id=auth.uid() and role in ('owner','admin'));
$$;
revoke all on function public.is_group_admin(uuid) from public,anon;
grant execute on function public.is_group_admin(uuid) to authenticated;

drop policy if exists "Users can view their group memberships" on public.group_members;
create policy "Members can view group membership roster"
on public.group_members for select to authenticated
using (user_id=auth.uid() or public.is_group_admin(group_id));

drop policy if exists "Authenticated members can view their groups" on public.groups;
create policy "Members can view their workspace"
on public.groups for select to authenticated
using (exists(select 1 from public.group_members gm where gm.group_id=groups.id and gm.user_id=auth.uid()));

create or replace function public.update_group_member_role(target_group_id uuid,target_user_id uuid,new_role text)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $$
declare actor_role text; target_role text;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 select role into actor_role from public.group_members where group_id=target_group_id and user_id=auth.uid();
 if actor_role <> 'owner' then raise exception 'OWNER_REQUIRED'; end if;
 if new_role not in ('admin','member') then raise exception 'INVALID_ROLE'; end if;
 select role into target_role from public.group_members where group_id=target_group_id and user_id=target_user_id;
 if target_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;
 if target_role='owner' then raise exception 'CANNOT_CHANGE_OWNER'; end if;
 update public.group_members set role=new_role where group_id=target_group_id and user_id=target_user_id;
 return true;
end;
$$;
revoke all on function public.update_group_member_role(uuid,uuid,text) from public,anon;
grant execute on function public.update_group_member_role(uuid,uuid,text) to authenticated;

create or replace function public.remove_group_member(target_group_id uuid,target_user_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $$
declare actor_role text; target_role text;
begin
 select role into actor_role from public.group_members where group_id=target_group_id and user_id=auth.uid();
 if actor_role not in ('owner','admin') then raise exception 'ADMIN_REQUIRED'; end if;
 select role into target_role from public.group_members where group_id=target_group_id and user_id=target_user_id;
 if target_role is null then return false; end if;
 if target_role='owner' then raise exception 'CANNOT_REMOVE_OWNER'; end if;
 if actor_role='admin' and target_role='admin' then raise exception 'ADMIN_CANNOT_REMOVE_ADMIN'; end if;
 delete from public.group_members where group_id=target_group_id and user_id=target_user_id;
 return true;
end;
$$;
revoke all on function public.remove_group_member(uuid,uuid) from public,anon;
grant execute on function public.remove_group_member(uuid,uuid) to authenticated;
