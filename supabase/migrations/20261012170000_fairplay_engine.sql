-- FairPlay MVP: attendance commitments and ratings, without handling real money.
-- A "pledge" records intent only; no payment, forfeiture, or automatic compensation is performed.

CREATE TABLE IF NOT EXISTS public.fairplay_ratings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_elos jsonb NOT NULL DEFAULT '{"padel":1200,"futbol":1200,"basket":1200,"boardgames":1200}'::jsonb,
  reliability_score numeric(3,2) NOT NULL DEFAULT 5.00 CHECK (reliability_score >= 0 AND reliability_score <= 5),
  attended_count integer NOT NULL DEFAULT 0 CHECK (attended_count >= 0),
  no_show_count integer NOT NULL DEFAULT 0 CHECK (no_show_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fairplay_sport_elos_object CHECK (jsonb_typeof(sport_elos) = 'object')
);

ALTER TABLE public.fairplay_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fairplay_ratings_read_authenticated ON public.fairplay_ratings;
CREATE POLICY fairplay_ratings_read_authenticated
  ON public.fairplay_ratings FOR SELECT TO authenticated
  USING (true);
REVOKE ALL ON public.fairplay_ratings FROM anon;
GRANT SELECT ON public.fairplay_ratings TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.fairplay_ratings FROM authenticated;

CREATE TABLE IF NOT EXISTS public.event_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Informational only: this is NOT money collected or a payment authorization.
  pledge_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (pledge_amount >= 0 AND pledge_amount <= 10000),
  status text NOT NULL DEFAULT 'pledged'
    CHECK (status IN ('pledged','attended','no_show','cancelled')),
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_pledges_event_status_idx
  ON public.event_pledges(event_id, status);

ALTER TABLE public.event_pledges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_pledges_select_participants ON public.event_pledges;
DROP POLICY IF EXISTS event_pledges_insert_self ON public.event_pledges;
DROP POLICY IF EXISTS event_pledges_update_organizer ON public.event_pledges;

CREATE POLICY event_pledges_select_participants
  ON public.event_pledges FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_pledges.event_id
        AND e.created_by = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.event_participants ep
      WHERE ep.event_id = event_pledges.event_id
        AND ep.user_id = (SELECT auth.uid())
        AND ep.status = 'yes'
    )
  );

CREATE POLICY event_pledges_insert_self
  ON public.event_pledges FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pledged'
    AND checked_in_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.event_participants ep
      WHERE ep.event_id = event_pledges.event_id
        AND ep.user_id = (SELECT auth.uid())
        AND ep.status = 'yes'
    )
  );

CREATE POLICY event_pledges_update_organizer
  ON public.event_pledges FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_pledges.event_id
        AND e.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_pledges.event_id
        AND e.created_by = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.event_pledges TO authenticated;
REVOKE ALL ON public.event_pledges FROM anon;

-- No SECURITY DEFINER functions or public RPCs: no client can move money or alter ELO.
