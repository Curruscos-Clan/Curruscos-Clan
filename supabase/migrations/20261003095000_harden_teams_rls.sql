-- Harden persistent teams: authenticated users may read public team records,
-- owners may create/update/delete their own teams, and members may read their membership.
REVOKE ALL ON TABLE public.teams FROM anon, authenticated;
REVOKE ALL ON TABLE public.team_members FROM anon, authenticated;
GRANT SELECT ON TABLE public.teams TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.teams TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.team_members TO authenticated;

DROP POLICY IF EXISTS teams_select_public ON public.teams;
DROP POLICY IF EXISTS teams_owner_insert ON public.teams;
DROP POLICY IF EXISTS teams_owner_update ON public.teams;
DROP POLICY IF EXISTS teams_owner_delete ON public.teams;
CREATE POLICY teams_select_public ON public.teams FOR SELECT USING (true);
CREATE POLICY teams_owner_insert ON public.teams FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY teams_owner_update ON public.teams FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY teams_owner_delete ON public.teams FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS team_members_select_authenticated ON public.team_members;
DROP POLICY IF EXISTS team_members_insert_owner ON public.team_members;
DROP POLICY IF EXISTS team_members_delete_owner_or_self ON public.team_members;
CREATE POLICY team_members_select_authenticated ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY team_members_insert_owner ON public.team_members FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid()));
CREATE POLICY team_members_delete_owner_or_self ON public.team_members FOR DELETE TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid()));
