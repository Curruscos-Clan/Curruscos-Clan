-- Keep the pre-existing hardened chat policies; the temporary duplicate policies
-- are removed because they caused redundant evaluation and had weaker expressions.
drop policy if exists "chat_rooms_select_member" on public.chat_rooms;
drop policy if exists "chat_room_members_select_self" on public.chat_room_members;
drop policy if exists "chat_messages_select_member" on public.chat_messages;
drop policy if exists "chat_messages_insert_member_self" on public.chat_messages;
drop policy if exists "chat_messages_update_own" on public.chat_messages;
