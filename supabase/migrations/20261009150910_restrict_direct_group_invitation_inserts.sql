-- Invitation creation must use the secure RPC, which serializes invites and checks plan limits.
drop policy if exists "Group owners and admins can create invitations" on public.group_invitations;