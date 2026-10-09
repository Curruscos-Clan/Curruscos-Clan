-- Prevent task ownership/context tampering and limit reassignment to the creator or group admins.
create or replace function public.protect_task_identity_and_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  actor_is_admin boolean := false;
begin
  if new.id is distinct from old.id
     or new.event_id is distinct from old.event_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Task identity fields cannot be changed';
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    select exists (
      select 1
      from public.events e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = old.event_id
        and gm.user_id = actor_id
        and gm.role in ('owner', 'admin')
    ) into actor_is_admin;

    if actor_id is distinct from old.created_by and not actor_is_admin then
      raise exception 'Only the task creator or a group admin can reassign a task';
    end if;

    if new.assigned_to is not null and not exists (
      select 1
      from public.events e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = old.event_id
        and gm.user_id = new.assigned_to
    ) then
      raise exception 'Task assignee must be a member of the event group';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_task_identity_and_assignment on public.tasks;
create trigger trg_protect_task_identity_and_assignment
before update on public.tasks
for each row execute function public.protect_task_identity_and_assignment();

revoke execute on function public.protect_task_identity_and_assignment() from public, anon, authenticated;
