-- Prevent chat messages from being moved between rooms or reassigned to another user.
create or replace function private.prevent_chat_message_identity_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.room_id <> old.room_id then
    raise exception 'CHAT_MESSAGE_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_chat_message_identity_changes() from public, anon, authenticated;

drop trigger if exists trg_chat_message_identity on public.chat_messages;
create trigger trg_chat_message_identity
before update on public.chat_messages
for each row execute function private.prevent_chat_message_identity_changes();

drop policy if exists "chat messages own update" on public.chat_messages;
create policy "chat messages own update"
on public.chat_messages
for update
to authenticated
using (
  user_id = (select auth.uid())
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.chat_room_members m
    where m.room_id = chat_messages.room_id
      and m.user_id = (select auth.uid())
  )
);