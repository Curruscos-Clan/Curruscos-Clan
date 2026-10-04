-- CURRUSCOS — keep persistent team membership behind the team owner/member boundary.
-- Public discovery uses dedicated RPCs; the raw membership table must not expose
-- user_id/role data to every authenticated client.

drop policy if exists team_members_select_authenticated on public.team_members;

create policy team_members_select_owner_or_self
on public.team_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.teams t
    where t.id = team_members.team_id
      and t.owner_id = (select auth.uid())
  )
);
