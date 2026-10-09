-- Remove former event-team members from the corresponding team chat.
-- The chat_room_members row controls both message visibility and sending.
create or replace function public.revoke_event_team_chat_membership_after_exit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.chat_room_members crm
  using public.chat_rooms cr
  where crm.room_id = cr.id
    and cr.type = 'team'
    and cr.team_id = old.team_id
    and crm.user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists revoke_event_team_chat_membership_after_exit on public.event_team_members;
create trigger revoke_event_team_chat_membership_after_exit
after delete on public.event_team_members
for each row execute function public.revoke_event_team_chat_membership_after_exit();

-- These functions are invoked by triggers, not by clients through RPC.
revoke execute on function public.revoke_group_chat_membership_after_group_exit() from public, anon, authenticated;
revoke execute on function public.revoke_event_chat_membership_after_attendance_change() from public, anon, authenticated;
revoke execute on function public.revoke_event_team_chat_membership_after_exit() from public, anon, authenticated;
