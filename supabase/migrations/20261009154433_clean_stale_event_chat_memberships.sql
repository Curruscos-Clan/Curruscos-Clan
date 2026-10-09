create or replace function public.revoke_event_chat_membership_after_attendance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    delete from public.chat_room_members crm
    using public.chat_rooms cr
    where crm.room_id = cr.id
      and cr.type = 'event'
      and cr.event_id = old.event_id
      and crm.user_id = old.user_id;
    return old;
  end if;

  if new.status is distinct from 'yes' then
    delete from public.chat_room_members crm
    using public.chat_rooms cr
    where crm.room_id = cr.id
      and cr.type = 'event'
      and cr.event_id = old.event_id
      and crm.user_id = old.user_id;
  end if;
  return new;
end;
$function$;

revoke execute on function public.revoke_event_chat_membership_after_attendance_change() from public, anon, authenticated;
