-- Keep persistent team identity and ownership metadata immutable after creation.
create or replace function public.prevent_team_identity_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Team identity fields cannot be changed';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_prevent_team_identity_changes on public.teams;
create trigger trg_prevent_team_identity_changes
before update on public.teams
for each row execute function public.prevent_team_identity_changes();

revoke execute on function public.prevent_team_identity_changes() from public, anon, authenticated;
