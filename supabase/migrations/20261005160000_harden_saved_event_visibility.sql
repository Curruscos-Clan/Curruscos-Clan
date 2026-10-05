-- Saved events may only target events the current user is allowed to discover.
-- Public events remain saveable; private/group events require group membership.
-- Unlisted events remain saveable only by their creator.

 drop policy if exists "saved events insert own" on public.saved_events;

create policy "saved events insert own"
on public.saved_events
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.events e
    where e.id = saved_events.event_id
      and (
        (e.visibility = 'public' and e.status in ('published', 'finished'))
        or (
          e.group_id is not null
          and exists (
            select 1
            from public.group_members gm
            where gm.group_id = e.group_id
              and gm.user_id = (select auth.uid())
          )
        )
        or (
          e.visibility = 'unlisted'
          and e.created_by = (select auth.uid())
        )
      )
  )
);
