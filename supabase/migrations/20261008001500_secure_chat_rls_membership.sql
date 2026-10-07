-- Chat RLS: access is granted by room membership.
-- Event participants obtain membership through get_or_create_event_chat().
create policy "chat_rooms_select_member"
on public.chat_rooms for select to authenticated
using (exists (select 1 from public.chat_room_members m where m.room_id=id and m.user_id=auth.uid()));

create policy "chat_room_members_select_self"
on public.chat_room_members for select to authenticated
using (user_id=auth.uid());

create policy "chat_messages_select_member"
on public.chat_messages for select to authenticated
using (exists (select 1 from public.chat_room_members m where m.room_id=room_id and m.user_id=auth.uid()));

create policy "chat_messages_insert_member_self"
on public.chat_messages for insert to authenticated
with check (user_id=auth.uid() and exists (select 1 from public.chat_room_members m where m.room_id=room_id and m.user_id=auth.uid()));

create policy "chat_messages_update_own"
on public.chat_messages for update to authenticated
using (user_id=auth.uid() and exists (select 1 from public.chat_room_members m where m.room_id=room_id and m.user_id=auth.uid()))
with check (user_id=auth.uid() and exists (select 1 from public.chat_room_members m where m.room_id=room_id and m.user_id=auth.uid()));

revoke all on public.chat_rooms, public.chat_room_members, public.chat_messages from anon;
grant select on public.chat_rooms, public.chat_room_members, public.chat_messages to authenticated;
grant insert, update on public.chat_messages to authenticated;
