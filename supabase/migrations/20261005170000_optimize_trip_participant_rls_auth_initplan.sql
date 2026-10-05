-- Optimize trip participant RLS auth calls so auth.uid() is evaluated once per statement.
drop policy if exists "Users can change own trip participation" on public.trip_participants;
create policy "Users can change own trip participation"
on public.trip_participants
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.trips t
    join public.group_members gm on gm.group_id = t.group_id
    where t.id = trip_participants.trip_id
      and gm.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.trips t
    join public.group_members gm on gm.group_id = t.group_id
    where t.id = trip_participants.trip_id
      and gm.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can leave trips" on public.trip_participants;
create policy "Users can leave trips"
on public.trip_participants
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.trips t
    join public.group_members gm on gm.group_id = t.group_id
    where t.id = trip_participants.trip_id
      and gm.user_id = (select auth.uid())
  )
);
