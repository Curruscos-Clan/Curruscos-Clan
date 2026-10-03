create index if not exists idx_group_invitations_group_pending on public.group_invitations(group_id,status) where status='pending';
create index if not exists idx_group_invitations_user_pending on public.group_invitations(invited_user_id,status) where status='pending';

create or replace function private.invite_user_by_username_secure(target_group_id uuid,target_username text)
returns public.group_invitations language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp
as $$
declare target_user_id uuid; new_invitation public.group_invitations; v_count integer; v_limit integer; group_name text; inviter_name text;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if not exists(select 1 from public.group_members where group_id=target_group_id and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'NO_PERMISSION'; end if;
 if length(trim(coalesce(target_username,'')))=0 then raise exception 'USERNAME_REQUIRED'; end if;
 select id into target_user_id from public.profiles where lower(username)=lower(trim(target_username)) limit 1;
 if target_user_id is null then raise exception 'USER_NOT_FOUND'; end if;
 if target_user_id=auth.uid() then raise exception 'SELF_INVITE'; end if;
 if exists(select 1 from public.group_members where group_id=target_group_id and user_id=target_user_id) then raise exception 'ALREADY_MEMBER'; end if;
 select p.max_members into v_limit from public.group_subscriptions s join public.workspace_plans p on p.code=s.plan_code where s.group_id=target_group_id and s.status in ('trialing','active') limit 1;
 if v_limit is null then select max_members into v_limit from public.workspace_plans where code='free'; end if;
 select count(*) into v_count from public.group_members where group_id=target_group_id;
 if v_limit is not null and v_count>=v_limit then raise exception 'PLAN_LIMIT_MEMBERS'; end if;
 if exists(select 1 from public.group_invitations where group_id=target_group_id and invited_user_id=target_user_id and status='pending') then raise exception 'INVITATION_ALREADY_PENDING'; end if;
 insert into public.group_invitations(group_id,invited_user_id,invited_by,status) values(target_group_id,target_user_id,auth.uid(),'pending') returning * into new_invitation;
 select name into group_name from public.groups where id=target_group_id;
 select coalesce(display_name,username,'Alguien') into inviter_name from public.profiles where id=auth.uid();
 insert into public.notifications(user_id,group_id,type,title,message,reference_id) values(target_user_id,target_group_id,'invitation','Nueva invitación',coalesce(inviter_name,'Alguien')||' te ha invitado a unirte a "'||coalesce(group_name,'un grupo')||'"',new_invitation.id);
 return new_invitation;
end;
$$;

create or replace function private.accept_group_invitation_secure(invitation_id uuid)
returns public.group_members language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp
as $$
declare invitation public.group_invitations; new_member public.group_members; v_count integer; v_limit integer; group_name text;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 select * into invitation from public.group_invitations where id=invitation_id and invited_user_id=auth.uid() and status='pending';
 if invitation.id is null then raise exception 'INVITATION_NOT_PENDING'; end if;
 if exists(select 1 from public.group_members where group_id=invitation.group_id and user_id=auth.uid()) then raise exception 'ALREADY_MEMBER'; end if;
 select p.max_members into v_limit from public.group_subscriptions s join public.workspace_plans p on p.code=s.plan_code where s.group_id=invitation.group_id and s.status in ('trialing','active') limit 1;
 if v_limit is null then select max_members into v_limit from public.workspace_plans where code='free'; end if;
 select count(*) into v_count from public.group_members where group_id=invitation.group_id;
 if v_limit is not null and v_count>=v_limit then raise exception 'PLAN_LIMIT_MEMBERS'; end if;
 insert into public.group_members(group_id,user_id,role) values(invitation.group_id,auth.uid(),'member') returning * into new_member;
 update public.group_invitations set status='accepted' where id=invitation.id;
 select name into group_name from public.groups where id=invitation.group_id;
 perform public.create_group_notifications(invitation.group_id,auth.uid(),'member','Nuevo miembro',coalesce((select coalesce(display_name,username,'Alguien') from public.profiles where id=auth.uid()),'Alguien')||' se ha unido a "'||coalesce(group_name,'el grupo')||'"',invitation.group_id);
 return new_member;
end;
$$;