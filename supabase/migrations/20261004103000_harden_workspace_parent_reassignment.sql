-- Keep workspace ownership stable when child records are edited.
-- RLS validates the resulting row and these triggers prevent cross-workspace
-- parent reassignment when both workspaces are otherwise accessible to a user.

drop policy if exists trips_update_creator_admin on public.trips;
create policy trips_update_creator_admin
on public.trips
for update to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = trips.group_id
      and gm.user_id = (select auth.uid())
      and gm.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = trips.group_id
      and gm.user_id = (select auth.uid())
  )
  and (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = trips.group_id
        and gm.user_id = (select auth.uid())
        and gm.role in ('owner','admin')
    )
  )
);

drop policy if exists trip_options_update_creator_admin on public.trip_options;
create policy trip_options_update_creator_admin
on public.trip_options
for update to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1
    from public.trips t
    join public.group_members gm on gm.group_id = t.group_id
    where t.id = trip_options.trip_id
      and gm.user_id = (select auth.uid())
      and gm.role in ('owner','admin')
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.trips t
    join public.group_members gm on gm.group_id = t.group_id
    where t.id = trip_options.trip_id
      and gm.user_id = (select auth.uid())
  )
);

create or replace function public.prevent_cross_workspace_parent_move()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_group_id uuid;
  new_group_id uuid;
begin
  if tg_table_name in ('trip_options','trip_itinerary_items') then
    select group_id into old_group_id from public.trips where id = old.trip_id;
    select group_id into new_group_id from public.trips where id = new.trip_id;
  elsif tg_table_name in ('tasks','expenses') then
    select group_id into old_group_id from public.events where id = old.event_id;
    select group_id into new_group_id from public.events where id = new.event_id;
  elsif tg_table_name = 'history_entries' then
    old_group_id := old.group_id;
    new_group_id := new.group_id;
    if old.event_id is not null then
      select group_id into old_group_id from public.events where id = old.event_id;
    end if;
    if new.event_id is not null then
      select group_id into new_group_id from public.events where id = new.event_id;
    end if;
  else
    return new;
  end if;

  if old_group_id is distinct from new_group_id then
    raise exception 'WORKSPACE_PARENT_CHANGE_NOT_ALLOWED';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_trip_option_cross_workspace_move on public.trip_options;
create trigger prevent_trip_option_cross_workspace_move
before update on public.trip_options
for each row execute function public.prevent_cross_workspace_parent_move();

drop trigger if exists prevent_trip_itinerary_cross_workspace_move on public.trip_itinerary_items;
create trigger prevent_trip_itinerary_cross_workspace_move
before update on public.trip_itinerary_items
for each row execute function public.prevent_cross_workspace_parent_move();

drop trigger if exists prevent_task_cross_workspace_move on public.tasks;
create trigger prevent_task_cross_workspace_move
before update on public.tasks
for each row execute function public.prevent_cross_workspace_parent_move();

drop trigger if exists prevent_expense_cross_workspace_move on public.expenses;
create trigger prevent_expense_cross_workspace_move
before update on public.expenses
for each row execute function public.prevent_cross_workspace_parent_move();

drop trigger if exists prevent_history_cross_workspace_move on public.history_entries;
create trigger prevent_history_cross_workspace_move
before update on public.history_entries
for each row execute function public.prevent_cross_workspace_parent_move();

revoke all on function public.prevent_cross_workspace_parent_move() from public, anon, authenticated;
