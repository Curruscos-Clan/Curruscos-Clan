-- Protect profile identity fields while allowing username, display name and avatar edits.
create or replace function public.prevent_profile_identity_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'Profile identity fields cannot be changed';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_profile_identity_changes() from public, anon, authenticated;

drop trigger if exists trg_prevent_profile_identity_changes on public.profiles;
create trigger trg_prevent_profile_identity_changes
before update on public.profiles
for each row
execute function public.prevent_profile_identity_changes();
