-- Optimize RLS policies by evaluating auth.uid() once per statement instead of once per row.
-- Authorization semantics are unchanged.

alter policy "Event creator or group admin manages matches" on public.event_matches
  using ((exists (select 1 from public.events e where e.id=event_matches.event_id and (e.created_by=(select auth.uid()) or exists (select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=(select auth.uid()) and gm.role in ('owner','admin'))))))
  with check ((exists (select 1 from public.events e where e.id=event_matches.event_id and (e.created_by=(select auth.uid()) or exists (select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=(select auth.uid()) and gm.role in ('owner','admin'))))));

alter policy "Event matches visible to event viewers" on public.event_matches
  using ((exists (select 1 from public.events e where e.id=event_matches.event_id and (((e.visibility='public') and e.status in ('published','finished')) or exists (select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=(select auth.uid()))))));

alter policy "Event creator or group admin manages team members" on public.event_team_members
  using ((exists (select 1 from public.event_teams et join public.events e on e.id=et.event_id where et.id=event_team_members.team_id and (e.created_by=(select auth.uid()) or exists (select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=(select auth.uid()) and gm.role in ('owner','admin'))))))
  with check ((exists (select 1 from public.event_teams et join public.events e on e.id=et.event_id where et.id=event_team_members.team_id and (e.created_by=(select auth.uid()) or exists (select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=(select auth.uid()) and gm.role in ('owner','admin'))))));

alter policy "Event team members visible to event viewers" on public.event_team_members
  using ((exists (select 1 from public.event_teams et join public.events e on e.id=et.event_id where et.id=event_team_members.team_id and (((e.visibility='public') and e.status in ('published','finished')) or exists (select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=(select auth.uid()))))));

alter policy "Event creator or group admin manages teams" on public.event_teams
  using ((exists (select 1 from public.events e where e.id=event_teams.event_id and (e.created_by=(select auth.uid()) or exists (select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=(select auth.uid()) and gm.role in ('owner','admin'))))))
  with check ((exists (select 1 from public.events e where e.id=event_teams.event_id and (e.created_by=(select auth.uid()) or exists (select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=(select auth.uid()) and gm.role in ('owner','admin'))))));

alter policy "Event teams visible to public event viewers" on public.event_teams
  using ((exists (select 1 from public.events e where e.id=event_teams.event_id and (((e.visibility='public') and e.status in ('published','finished')) or exists (select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=(select auth.uid()))))));

alter policy "expense_splits_delete_creator_or_admin" on public.expense_splits
  using ((exists (select 1 from public.expenses e join public.events ev on ev.id=e.event_id join public.group_members gm on gm.group_id=ev.group_id where e.id=expense_splits.expense_id and gm.user_id=(select auth.uid()) and (e.created_by=(select auth.uid()) or gm.role in ('owner','admin')))));

alter policy "expense_splits_insert_creator_or_admin" on public.expense_splits
  with check ((exists (select 1 from public.expenses e join public.events ev on ev.id=e.event_id join public.group_members gm on gm.group_id=ev.group_id where e.id=expense_splits.expense_id and gm.user_id=(select auth.uid()) and (e.created_by=(select auth.uid()) or gm.role in ('owner','admin')))) and exists (select 1 from public.expenses e join public.events ev on ev.id=e.event_id join public.group_members gm on gm.group_id=ev.group_id where e.id=expense_splits.expense_id and gm.user_id=expense_splits.user_id));

alter policy "expense_splits_select_member" on public.expense_splits
  using ((exists (select 1 from public.expenses e join public.events ev on ev.id=e.event_id join public.group_members gm on gm.group_id=ev.group_id where e.id=expense_splits.expense_id and gm.user_id=(select auth.uid()))));

alter policy "Members can view group membership roster" on public.group_members
  using ((user_id=(select auth.uid()) or is_group_admin(group_id)));

alter policy "group_subscriptions_member_read" on public.group_subscriptions
  using ((exists (select 1 from public.group_members gm where gm.group_id=group_subscriptions.group_id and gm.user_id=(select auth.uid()))));

alter policy "Members can view their workspace" on public.groups
  using ((exists (select 1 from public.group_members gm where gm.group_id=groups.id and gm.user_id=(select auth.uid()))));

alter policy "plan_requests_insert_own_group" on public.plan_requests
  with check ((user_id=(select auth.uid()) and exists (select 1 from public.group_members gm where gm.group_id=plan_requests.group_id and gm.user_id=(select auth.uid()) and gm.role in ('owner','admin'))));

alter policy "plan_requests_select_own_group" on public.plan_requests
  using ((exists (select 1 from public.group_members gm where gm.group_id=plan_requests.group_id and gm.user_id=(select auth.uid()))));

alter policy "team_follows_delete_own" on public.team_follows
  using ((follower_id=(select auth.uid())));

alter policy "team_follows_insert_own" on public.team_follows
  with check ((follower_id=(select auth.uid())));

alter policy "team_members_delete_owner_or_self" on public.team_members
  using ((user_id=(select auth.uid()) or exists (select 1 from public.teams t where t.id=team_members.team_id and t.owner_id=(select auth.uid()))));

alter policy "team_members_insert_owner" on public.team_members
  with check ((exists (select 1 from public.teams t where t.id=team_members.team_id and t.owner_id=(select auth.uid()))));

alter policy "teams_owner_delete" on public.teams
  using ((owner_id=(select auth.uid())));

alter policy "teams_owner_insert" on public.teams
  with check ((owner_id=(select auth.uid())));

alter policy "teams_owner_update" on public.teams
  using ((owner_id=(select auth.uid())))
  with check ((owner_id=(select auth.uid())));
