-- Keep the authenticated participant policy separate from anonymous reads.
-- Anonymous callers cannot execute is_public_event_organizer, and must never
-- need that helper merely to obtain the public event feed's participant count.
drop policy if exists "Users can view own group or confirmed public participation"
  on public.event_participants;
drop policy if exists "Anonymous visitors can view confirmed public event participants"
  on public.event_participants;

create policy "Users can view own group or confirmed public participation"
on public.event_participants
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_public_event_organizer(event_participants.event_id)
  or exists (
    select 1
    from public.events e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = event_participants.event_id
      and gm.user_id = (select auth.uid())
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

create policy "Anonymous visitors can view confirmed public event participants"
on public.event_participants
for select
to anon
using (
  status = 'yes'
  and exists (
    select 1
    from public.events e
    where e.id = event_participants.event_id
      and e.visibility = 'public'
      and e.status in ('published','preparing','live','finished')
  )
);
