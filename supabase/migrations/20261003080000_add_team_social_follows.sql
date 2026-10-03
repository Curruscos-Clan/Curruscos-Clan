CREATE TABLE IF NOT EXISTS public.team_follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, team_id)
);
ALTER TABLE public.team_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_follows_select_public" ON public.team_follows;
CREATE POLICY "team_follows_select_public" ON public.team_follows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "team_follows_insert_own" ON public.team_follows;
CREATE POLICY "team_follows_insert_own" ON public.team_follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS "team_follows_delete_own" ON public.team_follows;
CREATE POLICY "team_follows_delete_own" ON public.team_follows FOR DELETE TO authenticated USING (follower_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_team_follows_team_id ON public.team_follows(team_id);
CREATE INDEX IF NOT EXISTS idx_team_follows_follower_id ON public.team_follows(follower_id);
CREATE OR REPLACE FUNCTION public.follow_team(target_team_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
 IF auth.uid() IS NULL OR target_team_id IS NULL THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id=target_team_id) THEN RETURN false; END IF;
 IF EXISTS (SELECT 1 FROM public.teams WHERE id=target_team_id AND owner_id=auth.uid()) THEN RETURN false; END IF;
 INSERT INTO public.team_follows(follower_id,team_id) VALUES(auth.uid(),target_team_id) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.unfollow_team(target_team_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ DELETE FROM public.team_follows WHERE follower_id=auth.uid() AND team_id=target_team_id; SELECT true; $$;
CREATE OR REPLACE FUNCTION public.get_team_follow_status(target_team_id uuid)
RETURNS TABLE(is_following boolean, follower_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS(SELECT 1 FROM public.team_follows WHERE follower_id=auth.uid() AND team_id=target_team_id), (SELECT count(*) FROM public.team_follows WHERE team_id=target_team_id); $$;
GRANT EXECUTE ON FUNCTION public.follow_team(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unfollow_team(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_follow_status(uuid) TO authenticated;