create or replace function private.prevent_chat_message_identity_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.room_id is distinct from old.room_id
     or new.created_at is distinct from old.created_at then
    raise exception 'CHAT_MESSAGE_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$function$;
