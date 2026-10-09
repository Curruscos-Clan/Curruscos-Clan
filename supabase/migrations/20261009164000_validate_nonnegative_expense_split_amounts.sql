-- Expense allocations must never create negative amounts.
alter table public.expense_splits
  add constraint expense_splits_amount_nonnegative
  check (amount >= 0);
