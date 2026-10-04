-- CURRUSCOS — harden invitation/role helper search paths
-- Keep authorization logic unchanged; remove mutable pg_temp/public search paths
-- from SECURITY DEFINER helpers.
alter function public.is_group_admin(uuid) set search_path='';

alter function private.invite_user_by_username_secure(uuid,text) set search_path='';
alter function private.accept_group_invitation_secure(uuid) set search_path='';
alter function private.get_group_pending_invitations(uuid) set search_path='';
alter function private.cancel_group_invitation_secure(uuid) set search_path='';

alter function public.get_group_pending_invitations(uuid) set search_path='';
alter function public.cancel_group_invitation(uuid) set search_path='';
