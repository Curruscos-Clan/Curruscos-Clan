-- Prevent an expense split from being reassigned to another expense or user.
create or replace function public.protect_expense_split_identity_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.expense_id is distinct from old.expense_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Expense split identity cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_expense_split_identity on public.expense_splits;
create trigger protect_expense_split_identity
before update on public.expense_splits
for each row
execute function public.protect_expense_split_identity_changes();