create or replace function public.prevent_workspace_group_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.group_id is distinct from new.group_id then
    raise exception 'WORKSPACE_GROUP_CHANGE_NOT_ALLOWED';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_history_workspace_change on public.history_entries;
create trigger prevent_history_workspace_change
before update on public.history_entries
for each row execute function public.prevent_workspace_group_change();

drop trigger if exists prevent_memory_workspace_change on public.memories;
create trigger prevent_memory_workspace_change
before update on public.memories
for each row execute function public.prevent_workspace_group_change();

drop trigger if exists prevent_poll_workspace_change on public.polls;
create trigger prevent_poll_workspace_change
before update on public.polls
for each row execute function public.prevent_workspace_group_change();

drop trigger if exists prevent_event_workspace_change on public.events;
create trigger prevent_event_workspace_change
before update on public.events
for each row execute function public.prevent_workspace_group_change();
