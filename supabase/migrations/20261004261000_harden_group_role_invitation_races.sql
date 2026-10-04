-- Serialize role changes and invitation cancellation per group.
create or replace function private.change_group_member_role_secure(target_group_id uuid,target_user_id uuid,new_role text)
returns public.group_members language plpgsql security definer set search_path=''
as $$
declare current_member public.group_members; target_member public.group_members;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_group_id::text,0));
 select * into current_member from public.group_members where group_id=target_group_id and user_id=auth.uid() for update;
 if current_member.id is null then raise exception 'GROUP_MEMBERSHIP_REQUIRED'; end if;
 if current_member.role <> 'owner' then raise exception 'OWNER_REQUIRED'; end if;
 if new_role not in ('admin','member') then raise exception 'INVALID_ROLE'; end if;
 select * into target_member from public.group_members where group_id=target_group_id and user_id=target_user_id for update;
 if target_member.id is null then raise exception 'MEMBER_NOT_FOUND'; end if;
 if target_member.role='owner' then raise exception 'CANNOT_CHANGE_OWNER'; end if;
 update public.group_members set role=new_role where id=target_member.id returning * into target_member;
 return target_member;
end; $$;

create or replace function private.cancel_group_invitation_secure(target_invitation_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare invitation public.group_invitations; actor_role text;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 select * into invitation from public.group_invitations where id=target_invitation_id and status='pending' for update;
 if invitation.id is null then raise exception 'INVITATION_NOT_PENDING'; end if;
 select role into actor_role from public.group_members where group_id=invitation.group_id and user_id=auth.uid() for update;
 if actor_role not in ('owner','admin') then raise exception 'NO_PERMISSION'; end if;
 update public.group_invitations set status='cancelled' where id=invitation.id;
 return true;
end; $$;
