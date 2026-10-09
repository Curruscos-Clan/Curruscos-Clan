-- Users may mark their own notifications read/unread, but cannot rewrite or reroute them.
create or replace function public.prevent_notification_identity_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.group_id is distinct from old.group_id
     or new.type is distinct from old.type
     or new.title is distinct from old.title
     or new.message is distinct from old.message
     or new.reference_id is distinct from old.reference_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Notification identity and content cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_notification_identity_changes() from public, anon, authenticated;

drop trigger if exists protect_notification_identity on public.notifications;
create trigger protect_notification_identity
before update on public.notifications
for each row execute function public.prevent_notification_identity_changes();
