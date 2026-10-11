-- Isolated PostgreSQL regression test for anonymous event-detail access.
-- This runs only in disposable GitHub Actions PostgreSQL, never production.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE TABLE public.events (
  id uuid PRIMARY KEY,
  group_id uuid,
  visibility text,
  status text
);
CREATE TABLE public.event_teams (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id)
);
CREATE TABLE public.group_members (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE TABLE public.event_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.event_teams(id),
  user_id uuid NOT NULL
);
CREATE TABLE public.event_race_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  participant_id uuid
);

INSERT INTO public.events (id, group_id, visibility, status) VALUES
  ('10000000-0000-0000-0000-000000000001', NULL, 'public', 'published'),
  ('10000000-0000-0000-0000-000000000002', NULL, 'private', 'published');
INSERT INTO public.event_teams (id, event_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
INSERT INTO public.event_team_members (team_id, user_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.event_race_results (event_id, participant_id) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');

ALTER TABLE public.event_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_race_results ENABLE ROW LEVEL SECURITY;

-- Reproduce the legacy policies that accidentally expose rows to anon.
CREATE POLICY "Event team members visible to event viewers"
ON public.event_team_members FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Public can view race results for public events"
ON public.event_race_results FOR SELECT TO authenticated, anon USING (true);

\i supabase/migrations/20261010150000_restrict_anonymous_event_details.sql

DO $test$
DECLARE
  team_roles text[];
  result_roles text[];
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_team_members'
      AND policyname = 'Event team members visible to event viewers'
  ) THEN
    RAISE EXCEPTION 'Legacy team-member policy still exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_race_results'
      AND policyname = 'Public can view race results for public events'
  ) THEN
    RAISE EXCEPTION 'Legacy race-result policy still exists';
  END IF;

  SELECT roles INTO team_roles
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'event_team_members'
    AND policyname = 'Authenticated event viewers can view team members';

  SELECT roles INTO result_roles
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'event_race_results'
    AND policyname = 'Authenticated users can view race results for public events';

  IF team_roles IS DISTINCT FROM ARRAY['authenticated']::text[] THEN
    RAISE EXCEPTION 'Team-member SELECT policy should target authenticated only; got %', team_roles;
  END IF;

  IF result_roles IS DISTINCT FROM ARRAY['authenticated']::text[] THEN
    RAISE EXCEPTION 'Race-result SELECT policy should target authenticated only; got %', result_roles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_team_members'
      AND policyname = 'Authenticated event viewers can view team members'
      AND qual LIKE '%visibility%'
      AND qual LIKE '%status%'
  ) THEN
    RAISE EXCEPTION 'Team-member policy must enforce public-event visibility and status';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_race_results'
      AND policyname = 'Authenticated users can view race results for public events'
      AND qual LIKE '%visibility%'
      AND qual LIKE '%status%'
  ) THEN
    RAISE EXCEPTION 'Race-result policy must enforce public-event visibility and status';
  END IF;
END
$test$;

SELECT 'Anonymous event-detail policy regression tests passed' AS result;
