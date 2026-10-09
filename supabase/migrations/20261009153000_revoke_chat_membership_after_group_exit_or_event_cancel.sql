-- Revoke stale chat-room membership when a user leaves a group or cancels event attendance.
create or replace function public.revoke_group_chat_membership_after_group_exit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.chat_room_members crm
  using public.chat_rooms cr
  where crm.room_id = cr.id
    and cr.type = 'group'
    and cr.group_id = old.group_id
    and crm.user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists revoke_group_chat_membership_after_group_exit on public.group_members;
create trigger revoke_group_chat_membership_after_group_exit
after delete on public.group_members
for each row execute function public.revoke_group_chat_membership_after_group_exit();

create or replace function public.revoke_event_chat_membership_after_attendance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'yes' and (tg_op = 'DELETE' or new.status is distinct from 'yes') then
    delete from public.chat_room_members crm
    using public.chat_rooms cr
    where crm.room_id = cr.id
      and cr.type = 'event'
      and cr.event_id = old.event_id
      and crm.user_id = old.user_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists revoke_event_chat_membership_after_attendance_change on public.event_participants;
create trigger revoke_event_chat_membership_after_attendance_change
after update of status or delete on public.event_participants
for each row execute function public.revoke_event_chat_membership_after_attendance_change();
