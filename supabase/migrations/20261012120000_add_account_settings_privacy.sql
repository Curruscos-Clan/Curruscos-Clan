-- Account preferences, server-enforced profile privacy, and safe account-erasure preparation.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_history boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT
    '{"event_updates":true,"comments":true,"participants":true,"invitations":true,"chat":true,"social":true}'::jsonb;

ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences SET DEFAULT
    '{"event_updates":true,"comments":true,"participants":true,"invitations":true,"chat":true,"social":true}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_notification_preferences_object'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_notification_preferences_object
      CHECK (jsonb_typeof(notification_preferences) = 'object');
  END IF;
END $$;

-- Public profile stats are returned only when the profile is public,
-- is owned by the requester, or the requester shares at least one group.
-- A disabled history hides metrics for everyone except the profile owner.
CREATE OR REPLACE FUNCTION public.get_public_profile(target_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  events_played bigint,
  wins bigint,
  draws bigint,
  losses bigint,
  points numeric,
  organized_events bigint,
  teams_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH profile AS (
    SELECT p.id, p.display_name, p.username, p.show_history
    FROM public.profiles p
    WHERE p.id = target_user_id
      AND (
        p.is_public IS TRUE
        OR p.id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.group_members viewer_member
          JOIN public.group_members target_member
            ON target_member.group_id = viewer_member.group_id
          WHERE viewer_member.user_id = (SELECT auth.uid())
            AND target_member.user_id = p.id
        )
      )
  ),
  public_events AS (
    SELECT e.id
    FROM public.events e
    WHERE e.visibility = 'public'
      AND e.status IN ('published', 'preparing', 'live', 'finished')
  ),
  parts AS (
    SELECT count(DISTINCT ep.event_id)::bigint AS events_played
    FROM public.event_participants ep
    JOIN public_events pe ON pe.id = ep.event_id
    WHERE ep.user_id = target_user_id
      AND ep.status = 'yes'
  ),
  matches AS (
    SELECT m.*, e.scoring_system
    FROM public.event_matches m
    JOIN public_events pe ON pe.id = m.event_id
    JOIN public.events e ON e.id = m.event_id
    WHERE m.status = 'finished'
      AND EXISTS (
        SELECT 1
        FROM public.event_team_members etm
        WHERE etm.user_id = target_user_id
          AND (etm.team_id = m.home_team_id OR etm.team_id = m.away_team_id)
      )
  ),
  rec AS (
    SELECT
      sum(CASE
        WHEN (m.home_team_id IN (SELECT etm.team_id FROM public.event_team_members etm WHERE etm.user_id = target_user_id) AND m.home_score > m.away_score)
          OR (m.away_team_id IN (SELECT etm.team_id FROM public.event_team_members etm WHERE etm.user_id = target_user_id) AND m.away_score > m.home_score)
        THEN 1 ELSE 0 END)::bigint AS wins,
      sum(CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END)::bigint AS draws,
      sum(CASE
        WHEN (m.home_team_id IN (SELECT etm.team_id FROM public.event_team_members etm WHERE etm.user_id = target_user_id) AND m.home_score < m.away_score)
          OR (m.away_team_id IN (SELECT etm.team_id FROM public.event_team_members etm WHERE etm.user_id = target_user_id) AND m.away_score < m.home_score)
        THEN 1 ELSE 0 END)::bigint AS losses,
      sum(CASE
        WHEN m.scoring_system = 'chess' THEN
          CASE WHEN m.home_team_id IN (SELECT etm.team_id FROM public.event_team_members etm WHERE etm.user_id = target_user_id) THEN m.home_score ELSE m.away_score END
        WHEN m.scoring_system = 'points' THEN
          CASE WHEN m.home_team_id IN (SELECT etm.team_id FROM public.event_team_members etm WHERE etm.user_id = target_user_id) THEN coalesce(m.home_score, 0) ELSE coalesce(m.away_score, 0) END
        ELSE CASE
          WHEN (m.home_team_id IN (SELECT etm.team_id FROM public.event_team_members etm WHERE etm.user_id = target_user_id) AND m.home_score > m.away_score)
            OR (m.away_team_id IN (SELECT etm.team_id FROM public.event_team_members etm WHERE etm.user_id = target_user_id) AND m.away_score > m.home_score) THEN 3
          WHEN m.home_score = m.away_score THEN 1 ELSE 0 END
      END)::numeric AS points
    FROM matches m
  ),
  teams AS (
    SELECT count(DISTINCT etm.team_id)::bigint AS teams_count
    FROM public.event_team_members etm
    JOIN public.event_teams et ON et.id = etm.team_id
    JOIN public.events e ON e.id = et.event_id
    WHERE etm.user_id = target_user_id
      AND e.visibility = 'public'
      AND e.status IN ('published', 'preparing', 'live', 'finished')
  ),
  org AS (
    SELECT count(*)::bigint AS organized_events
    FROM public.events e
    WHERE e.visibility = 'public'
      AND e.status IN ('published', 'preparing', 'live', 'finished')
      AND e.created_by = target_user_id
  )
  SELECT
    p.id,
    coalesce(p.display_name, p.username, 'Jugador'),
    p.username,
    CASE WHEN p.show_history OR p.id = (SELECT auth.uid()) THEN coalesce(parts.events_played, 0) ELSE 0 END,
    CASE WHEN p.show_history OR p.id = (SELECT auth.uid()) THEN coalesce(rec.wins, 0) ELSE 0 END,
    CASE WHEN p.show_history OR p.id = (SELECT auth.uid()) THEN coalesce(rec.draws, 0) ELSE 0 END,
    CASE WHEN p.show_history OR p.id = (SELECT auth.uid()) THEN coalesce(rec.losses, 0) ELSE 0 END,
    CASE WHEN p.show_history OR p.id = (SELECT auth.uid()) THEN coalesce(rec.points, 0) ELSE 0 END,
    CASE WHEN p.show_history OR p.id = (SELECT auth.uid()) THEN coalesce(org.organized_events, 0) ELSE 0 END,
    CASE WHEN p.show_history OR p.id = (SELECT auth.uid()) THEN coalesce(teams.teams_count, 0) ELSE 0 END
  FROM profile p
  CROSS JOIN parts
  CROSS JOIN rec
  CROSS JOIN org
  CROSS JOIN teams;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profile_activity(target_user_id uuid)
RETURNS TABLE(
  event_id uuid,
  title text,
  event_date date,
  event_time time without time zone,
  location text,
  event_type text,
  category text,
  format text,
  status text,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    e.id, e.title, e.date, e.time, e.location, e.event_type, e.category, e.format, e.status,
    CASE WHEN e.created_by = target_user_id THEN 'organizer' ELSE 'participant' END
  FROM public.events e
  JOIN public.profiles p ON p.id = target_user_id
  WHERE e.visibility = 'public'
    AND e.status IN ('published', 'preparing', 'live', 'finished')
    AND (
      e.created_by = target_user_id
      OR EXISTS (
        SELECT 1
        FROM public.event_participants ep
        WHERE ep.event_id = e.id
          AND ep.user_id = target_user_id
          AND ep.status = 'yes'
      )
    )
    AND (p.show_history IS TRUE OR p.id = (SELECT auth.uid()))
    AND (
      p.is_public IS TRUE
      OR p.id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.group_members viewer_member
        JOIN public.group_members target_member ON target_member.group_id = viewer_member.group_id
        WHERE viewer_member.user_id = (SELECT auth.uid())
          AND target_member.user_id = p.id
      )
    )
  ORDER BY e.date DESC, e.time DESC NULLS LAST
  LIMIT 30;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profile_teams(target_user_id uuid)
RETURNS TABLE(
  team_id uuid,
  team_name text,
  event_id uuid,
  event_title text,
  event_date date,
  event_type text,
  event_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT t.id, t.name, e.id, e.title, e.date, e.event_type, e.status
  FROM public.event_team_members etm
  JOIN public.event_teams t ON t.id = etm.team_id
  JOIN public.events e ON e.id = t.event_id
  JOIN public.profiles p ON p.id = target_user_id
  WHERE etm.user_id = target_user_id
    AND e.visibility = 'public'
    AND e.status IN ('published', 'preparing', 'live', 'finished')
    AND (p.show_history IS TRUE OR p.id = (SELECT auth.uid()))
    AND (
      p.is_public IS TRUE
      OR p.id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.group_members viewer_member
        JOIN public.group_members target_member ON target_member.group_id = viewer_member.group_id
        WHERE viewer_member.user_id = (SELECT auth.uid())
          AND target_member.user_id = p.id
      )
    )
  ORDER BY e.date DESC, e.time DESC NULLS LAST
  LIMIT 20;
$function$;

-- The global Explore list must never advertise restricted profiles.
CREATE OR REPLACE FUNCTION public.get_public_active_people(
  search_text text DEFAULT NULL::text,
  target_event_type text DEFAULT 'all'::text
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  public_events bigint,
  public_teams bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH visible_events AS (
    SELECT e.id, e.event_type
    FROM public.events e
    WHERE e.visibility = 'public'
      AND e.status IN ('published', 'preparing', 'live', 'finished')
  ),
  participants AS (
    SELECT ep.user_id, count(DISTINCT ep.event_id)::bigint AS event_count
    FROM public.event_participants ep
    JOIN visible_events e ON e.id = ep.event_id
    WHERE ep.status = 'yes'
      AND (target_event_type = 'all' OR e.event_type = target_event_type)
    GROUP BY ep.user_id
  ),
  organizers AS (
    SELECT e.created_by AS user_id, count(DISTINCT e.id)::bigint AS event_count
    FROM visible_events ve
    JOIN public.events e ON e.id = ve.id
    WHERE e.created_by IS NOT NULL
      AND (target_event_type = 'all' OR e.event_type = target_event_type)
    GROUP BY e.created_by
  ),
  people AS (
    SELECT user_id FROM participants
    UNION
    SELECT user_id FROM organizers
  )
  SELECT
    p.id,
    p.display_name,
    p.username,
    p.avatar_url,
    CASE WHEN p.show_history OR p.id = (SELECT auth.uid())
      THEN greatest(coalesce(pa.event_count, 0), coalesce(o.event_count, 0))::bigint
      ELSE 0::bigint
    END,
    CASE WHEN p.show_history OR p.id = (SELECT auth.uid()) THEN
      (SELECT count(DISTINCT etm.team_id)::bigint
       FROM public.event_team_members etm
       JOIN public.event_teams t ON t.id = etm.team_id
       JOIN visible_events ve ON ve.id = t.event_id
       WHERE etm.user_id = p.id
         AND (target_event_type = 'all' OR ve.event_type = target_event_type))
      ELSE 0::bigint
    END
  FROM people x
  JOIN public.profiles p ON p.id = x.user_id
  LEFT JOIN participants pa ON pa.user_id = p.id
  LEFT JOIN organizers o ON o.user_id = p.id
  WHERE p.is_public IS TRUE
    AND (
      nullif(trim(coalesce(search_text, '')), '') IS NULL
      OR p.display_name ILIKE '%' || trim(search_text) || '%'
      OR p.username ILIKE '%' || trim(search_text) || '%'
    )
  ORDER BY greatest(coalesce(pa.event_count, 0), coalesce(o.event_count, 0)) DESC, p.display_name ASC
  LIMIT 24;
$function$;

-- This procedure is available only to the trusted account-erasure Edge Function.
-- It removes the user's authored trip contributions, transfers owned trips and
-- clan ownership to a surviving member when possible, then lets Auth cascade
-- the remaining profile-linked records.
CREATE OR REPLACE FUNCTION public.prepare_account_deletion(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  group_row record;
  trip_row record;
  replacement_user_id uuid;
BEGIN
  DELETE FROM public.trip_itinerary_items WHERE created_by = target_user_id;
  DELETE FROM public.trip_options WHERE created_by = target_user_id;

  FOR group_row IN
    SELECT gm.group_id
    FROM public.group_members gm
    WHERE gm.user_id = target_user_id AND gm.role = 'owner'
  LOOP
    replacement_user_id := NULL;
    SELECT gm.user_id INTO replacement_user_id
    FROM public.group_members gm
    WHERE gm.group_id = group_row.group_id
      AND gm.user_id <> target_user_id
    ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, gm.joined_at ASC
    LIMIT 1;

    IF replacement_user_id IS NOT NULL THEN
      UPDATE public.group_members
      SET role = 'admin'
      WHERE group_id = group_row.group_id AND user_id = target_user_id;

      UPDATE public.group_members
      SET role = 'owner'
      WHERE group_id = group_row.group_id AND user_id = replacement_user_id;
    END IF;
  END LOOP;

  FOR trip_row IN
    SELECT t.id, t.group_id
    FROM public.trips t
    WHERE t.created_by = target_user_id
  LOOP
    replacement_user_id := NULL;
    SELECT gm.user_id INTO replacement_user_id
    FROM public.group_members gm
    WHERE gm.group_id = trip_row.group_id
      AND gm.user_id <> target_user_id
    ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, gm.joined_at ASC
    LIMIT 1;

    IF replacement_user_id IS NULL THEN
      DELETE FROM public.trips WHERE id = trip_row.id;
    ELSE
      UPDATE public.trips
      SET created_by = replacement_user_id, updated_at = now()
      WHERE id = trip_row.id;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) TO service_role;
