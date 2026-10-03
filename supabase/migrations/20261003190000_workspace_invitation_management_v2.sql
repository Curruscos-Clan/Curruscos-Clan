create or replace function private.get_group_pending_invitations(target_group_id uuid)
returns table(id uuid,group_id uuid,status text,created_at timestamptz,invited_user_id uuid,invited_username text,invited_display_name text)
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp
as $$
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if not exists(select 1 from public.group_members where group_id=target_group_id and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'NO_PERMISSION'; end if;
 return query
 select gi.id,gi.group_id,gi.status,gi.created_at,gi.invited_user_id,p.username,p.display_name
 from public.group_invitations gi left join public.profiles p on p.id=gi.invited_user_id
 where gi.group_id=target_group_id and gi.status='pending' order by gi.created_at desc;
end; $$;

create or replace function private.cancel_group_invitation_secure(target_invitation_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp
as $$
declare v_group uuid;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 select group_id into v_group from public.group_invitations where id=target_invitation_id and status='pending';
 if v_group is null then raise exception 'INVITATION_NOT_PENDING'; end if;
 if not exists(select 1 from public.group_members where group_id=v_group and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'NO_PERMISSION'; end if;
 update public.group_invitations set status='cancelled' where id=target_invitation_id;
 return true;
end; $$;

create or replace function public.get_group_pending_invitations(target_group_id uuid)
returns table(id uuid,group_id uuid,status text,created_at timestamptz,invited_user_id uuid,invited_username text,invited_display_name text)
language sql security invoker set search_path=pg_catalog,public,auth,pg_temp
as $$ select * from private.get_group_pending_invitations($1); $$;

create or replace function public.cancel_group_invitation(target_invitation_id uuid)
returns boolean language sql security invoker set search_path=pg_catalog,public,auth,pg_temp
as $$ select private.cancel_group_invitation_secure($1); $$;
revoke all on function public.get_group_pending_invitations(uuid) from public,anon;
revoke all on function public.cancel_group_invitation(uuid) from public,anon;
grant execute on function public.get_group_pending_invitations(uuid) to authenticated;
grant execute on function public.cancel_group_invitation(uuid) to authenticated;
