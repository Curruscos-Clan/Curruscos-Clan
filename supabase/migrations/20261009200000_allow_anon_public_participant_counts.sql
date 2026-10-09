-- Ensure anonymous visitors can read only confirmed rows for public events.
-- This keeps the public event feed's embedded event_participants(count) useful
-- without exposing pending/declined or non-public participation.
drop policy if exists "Users can view own group or confirmed public participation"
  on public.event_participants;

create policy "Users can view own group or confirmed public participation"
on public.event_participants
for select
to anon, authenticated
using (
  (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  )
  or (
    (select auth.uid()) is not null
    and public.is_public_event_organizer(event_participants.event_id)
  )
  or (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.events e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = event_participants.event_id
        and gm.user_id = (select auth.uid())
    )
  )
  or (
    status = 'yes'
    and exists (
      select 1
      from public.events e
      where e.id = event_participants.event_id
        and e.visibility = 'public'
        and e.status in ('published','preparing','live','finished')
    )
  )
);
