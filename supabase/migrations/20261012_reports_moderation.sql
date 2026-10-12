-- Curruscos: structured content reports with conservative automatic hiding.
-- Apply through the reviewed Supabase migration workflow; do not execute from the browser.

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('event', 'comment', 'community_post', 'profile')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'fraud', 'inappropriate', 'other')),
  details text CHECK (details IS NULL OR char_length(details) <= 600),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS reports_target_pending_idx
  ON public.reports (target_type, target_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS reports_reporter_created_idx
  ON public.reports (reporter_id, created_at DESC);

-- Avoid repeated pending reports by the same account for the same target.
CREATE UNIQUE INDEX IF NOT EXISTS reports_one_pending_per_reporter_target
  ON public.reports (reporter_id, target_type, target_id)
  WHERE status = 'pending';

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear reportes" ON public.reports;
DROP POLICY IF EXISTS "Los usuarios pueden consultar sus propios reportes" ON public.reports;
CREATE POLICY reports_insert_own
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY reports_select_own
  ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- The client cannot read other users' reports or change status/resolution fields.
REVOKE ALL ON public.reports FROM anon;
GRANT SELECT, INSERT ON public.reports TO authenticated;
REVOKE UPDATE, DELETE ON public.reports FROM authenticated;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.event_comments
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.check_report_threshold_and_hide()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  pending_count integer;
BEGIN
  SELECT count(*)::integer INTO pending_count
  FROM public.reports
  WHERE target_type = NEW.target_type
    AND target_id = NEW.target_id
    AND status = 'pending';

  -- A threshold only hides content types with a known storage table.
  -- Profiles remain visible pending human review.
  IF pending_count >= 3 THEN
    IF NEW.target_type = 'event' THEN
      UPDATE public.events SET is_hidden = true WHERE id = NEW.target_id;
    ELSIF NEW.target_type = 'comment' THEN
      UPDATE public.event_comments SET is_hidden = true WHERE id = NEW.target_id;
    ELSIF NEW.target_type = 'community_post' THEN
      UPDATE public.community_posts SET is_hidden = true WHERE id = NEW.target_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_report_check_threshold ON public.reports;
CREATE TRIGGER on_new_report_check_threshold
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.check_report_threshold_and_hide();

-- The trigger invokes this function; callers cannot invoke it as a normal RPC.
REVOKE ALL ON FUNCTION public.check_report_threshold_and_hide() FROM PUBLIC, anon, authenticated;
