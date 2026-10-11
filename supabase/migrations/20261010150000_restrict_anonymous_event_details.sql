-- Public participant/team/result details are served by the authenticated RPCs.
-- The previous table policies also targeted anon, bypassing the intended RPC grant boundary.
drop policy if exists "Event team members visible to event viewers"
  on public.event_team_members;
create policy "Authenticated event viewers can view team members"
on public.event_team_members
for select
to authenticated
using (
  exists (
    select 1
    from public.event_teams et
    join public.events e on e.id = et.event_id
    where et.id = event_team_members.team_id
      and (
        (e.visibility = 'public' and e.status in ('published', 'preparing', 'live', 'finished'))
        or exists (
          select 1
          from public.group_members gm
          where gm.group_id = e.group_id
            and gm.user_id = (select auth.uid())
        )
      )
  )
);

drop policy if exists "Public can view race results for public events"
  on public.event_race_results;
create policy "Authenticated users can view race results for public events"
on public.event_race_results
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_race_results.event_id
      and e.visibility = 'public'
      and e.status in ('published', 'preparing', 'live', 'finished')
  )
);
