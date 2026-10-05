-- Harden trip participant identity and workspace scope.
drop policy if exists "Users can change own trip participation" on public.trip_participants;
drop policy if exists "Users can leave trips" on public.trip_participants;

create policy "Users can change own trip participation"
on public.trip_participants
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.trips t
    join public.group_members gm on gm.group_id = t.group_id
    where t.id = trip_participants.trip_id
      and gm.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.trips t
    join public.group_members gm on gm.group_id = t.group_id
    where t.id = trip_participants.trip_id
      and gm.user_id = auth.uid()
  )
);

create policy "Users can leave trips"
on public.trip_participants
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.trips t
    join public.group_members gm on gm.group_id = t.group_id
    where t.id = trip_participants.trip_id
      and gm.user_id = auth.uid()
  )
);

create or replace function public.protect_trip_participant_identity_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.trip_id is distinct from old.trip_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Trip participant identity cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_trip_participant_identity on public.trip_participants;
create trigger protect_trip_participant_identity
before update on public.trip_participants
for each row execute function public.protect_trip_participant_identity_changes();