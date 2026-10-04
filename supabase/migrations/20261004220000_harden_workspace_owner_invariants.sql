-- CURRUSCOS — workspace owner invariants
-- Owner/admin mutations are RPC-only: group_members has no direct UPDATE/DELETE
-- policies, and privileged RPCs cannot modify/remove the owner.
-- Role changes are restricted to the owner and owner targets are immutable.
-- Keep SECURITY DEFINER helpers on an empty search_path.

create or replace function public.update_group_member_role(target_group_id uuid,target_user_id uuid,new_role text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare actor_role text; target_role text;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 select role into actor_role from public.group_members where group_id=target_group_id and user_id=auth.uid();
 if actor_role <> 'owner' then raise exception 'OWNER_REQUIRED'; end if;
 if new_role not in ('admin','member') then raise exception 'INVALID_ROLE'; end if;
 select role into target_role from public.group_members where group_id=target_group_id and user_id=target_user_id for update;
 if target_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;
 if target_role='owner' then raise exception 'CANNOT_CHANGE_OWNER'; end if;
 update public.group_members set role=new_role where group_id=target_group_id and user_id=target_user_id;
 return true;
end;
$$;

create or replace function public.remove_group_member(target_group_id uuid,target_user_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare actor_role text; target_role text;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_group_id::text,0));
 select role into actor_role from public.group_members where group_id=target_group_id and user_id=auth.uid();
 if actor_role not in ('owner','admin') then raise exception 'ADMIN_REQUIRED'; end if;
 select role into target_role from public.group_members where group_id=target_group_id and user_id=target_user_id for update;
 if target_role is null then return false; end if;
 if target_role='owner' then raise exception 'CANNOT_REMOVE_OWNER'; end if;
 if actor_role='admin' and target_role='admin' then raise exception 'ADMIN_CANNOT_REMOVE_ADMIN'; end if;
 delete from public.group_members where group_id=target_group_id and user_id=target_user_id;
 return true;
end;
$$;

-- Defensive trigger: direct membership writes are already blocked by RLS.
-- The trigger is intentionally kept inert because group deletion cascades to
-- group_members and must not be blocked by an owner-invariant check.
create or replace function private.prevent_last_owner_removal()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 return old;
end;
$$;
