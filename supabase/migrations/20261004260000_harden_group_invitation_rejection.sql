-- Keep group invitation rejection scoped to the invited user and a pending invitation.
create or replace function private.reject_group_invitation_secure(target_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare invitation public.group_invitations;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into invitation from public.group_invitations
  where id=target_invitation_id and invited_user_id=auth.uid() and status='pending'
  for update;
  if invitation.id is null then raise exception 'INVITATION_NOT_PENDING'; end if;
  update public.group_invitations set status='rejected' where id=invitation.id;
  return true;
end;
$$;
revoke all on function private.reject_group_invitation_secure(uuid) from public,anon,authenticated;
create or replace function public.reject_group_invitation(target_invitation_id uuid)
returns boolean language sql security invoker set search_path=''
as $$ select private.reject_group_invitation_secure($1); $$;
revoke all on function public.reject_group_invitation(uuid) from public,anon;
grant execute on function public.reject_group_invitation(uuid) to authenticated;
