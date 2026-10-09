create or replace function public.prevent_expense_identity_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.event_id is distinct from old.event_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Expense identity fields cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_expense_identity_changes on public.expenses;
create trigger trg_prevent_expense_identity_changes
before update on public.expenses
for each row execute function public.prevent_expense_identity_changes();

revoke execute on function public.prevent_expense_identity_changes() from public, anon, authenticated;
