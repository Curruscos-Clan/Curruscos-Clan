-- Keep persistent teams private at the base-table level.
-- Public team discovery is exposed through dedicated SECURITY DEFINER RPCs.
drop policy if exists teams_select_public on public.teams;

create policy teams_select_owner
on public.teams
for select to authenticated
using (owner_id = (select auth.uid()));
