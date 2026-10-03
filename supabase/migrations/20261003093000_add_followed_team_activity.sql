CREATE OR REPLACE FUNCTION public.get_social_activity()
RETURNS TABLE(activity_type text, actor_id uuid, actor_name text, actor_username text, event_id uuid, event_title text, event_type text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH followed_people AS (
  SELECT following_id FROM public.user_follows WHERE follower_id=auth.uid()
),
followed_teams AS (
  SELECT team_id FROM public.team_follows WHERE follower_id=auth.uid()
),
created AS (
  SELECT 'event'::text,e.created_by,coalesce(p.display_name,p.username,'Usuario'),p.username,e.id,e.title,e.event_type,e.created_at
  FROM public.events e JOIN followed_people f ON f.following_id=e.created_by
  LEFT JOIN public.profiles p ON p.id=e.created_by
  WHERE e.visibility='public' AND e.status IN('published','preparing','live','finished')
),
joined AS (
  SELECT 'join'::text,s.user_id,coalesce(p.display_name,p.username,'Usuario'),p.username,e.id,e.title,e.event_type,s.created_at
  FROM public.user_activity_signals s JOIN followed_people f ON f.following_id=s.user_id
  JOIN public.events e ON e.id=s.event_id LEFT JOIN public.profiles p ON p.id=s.user_id
  WHERE s.signal_type='join' AND e.visibility='public' AND e.status IN('published','preparing','live','finished')
),
team_registered AS (
  SELECT 'team_join'::text,et.persistent_team_id,t.name,NULL::text,e.id,e.title,e.event_type,et.created_at
  FROM public.event_teams et JOIN followed_teams ft ON ft.team_id=et.persistent_team_id
  JOIN public.teams t ON t.id=et.persistent_team_id JOIN public.events e ON e.id=et.event_id
  WHERE et.persistent_team_id IS NOT NULL AND e.visibility='public' AND e.status IN('published','preparing','live','finished')
),
team_results AS (
  SELECT DISTINCT ON (et.persistent_team_id,em.event_id)
    'team_result'::text,et.persistent_team_id,t.name,NULL::text,e.id,e.title,e.event_type,em.created_at
  FROM public.event_matches em
  JOIN public.event_teams et ON et.id=em.home_team_id OR et.id=em.away_team_id
  JOIN followed_teams ft ON ft.team_id=et.persistent_team_id
  JOIN public.teams t ON t.id=et.persistent_team_id JOIN public.events e ON e.id=em.event_id
  WHERE et.persistent_team_id IS NOT NULL AND em.status='finished' AND e.visibility='public'
    AND e.status IN('published','preparing','live','finished')
  ORDER BY et.persistent_team_id,em.event_id,em.created_at DESC
)
SELECT * FROM (
 SELECT * FROM created UNION ALL SELECT * FROM joined
 UNION ALL SELECT * FROM team_registered UNION ALL SELECT * FROM team_results
) x ORDER BY created_at DESC LIMIT 50;
$function$;

-- Los equipos seguidos pasan a formar parte de "Tu comunidad":
-- inscripción/participación pública y partidos terminados de sus equipos.