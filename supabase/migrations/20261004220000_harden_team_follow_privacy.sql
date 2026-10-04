-- CURRUSCOS — follow relationships are private; public counters/status use RPCs.
drop policy if exists "team_follows_select_public" on public.team_follows;

create policy "team_follows_select_own"
on public.team_follows
for select
to authenticated
using (follower_id = (select auth.uid()));
