-- Prevent event tasks and expenses from being moved between events
-- or having their creator reassigned through direct UPDATE.

create or replace function public.protect_event_child_identity_changes()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'public', 'auth', 'pg_temp'
as $function$
begin
  if new.event_id is distinct from old.event_id then
    raise exception 'El evento padre no se puede cambiar';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'El creador no se puede cambiar';
  end if;

  return new;
end;
$function$;

drop trigger if exists protect_tasks_identity on public.tasks;
create trigger protect_tasks_identity
before update on public.tasks
for each row
execute function public.protect_event_child_identity_changes();

drop trigger if exists protect_expenses_identity on public.expenses;
create trigger protect_expenses_identity
before update on public.expenses
for each row
execute function public.protect_event_child_identity_changes();
