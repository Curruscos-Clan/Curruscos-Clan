-- Prevent the public profile RPC from exposing identities for users with no public activity.
-- This RPC intentionally remains public for profiles discoverable through public events/teams.
create or replace function public.get_public_profile(target_user_id uuid)
returns table(
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
language sql
security definer
set search_path = ''
as $function$
with pe as (
  select id
  from public.events
  where visibility = 'public'
    and status in ('published', 'preparing', 'live', 'finished')
),
parts as (
  select count(distinct ep.event_id)::bigint as events_played
  from public.event_participants ep
  join pe on pe.id = ep.event_id
  where ep.user_id = target_user_id
    and ep.status = 'yes'
),
matches as (
  select m.*, e.scoring_system
  from public.event_matches m
  join pe on pe.id = m.event_id
  join public.events e on e.id = m.event_id
  where m.status = 'finished'
    and exists (
      select 1
      from public.event_team_members etm
      where etm.user_id = target_user_id
        and (etm.team_id = m.home_team_id or etm.team_id = m.away_team_id)
    )
),
rec as (
  select
    sum(case
      when (home_team_id in (select team_id from public.event_team_members where user_id = target_user_id) and home_score > away_score)
        or (away_team_id in (select team_id from public.event_team_members where user_id = target_user_id) and away_score > home_score)
      then 1 else 0 end)::bigint as wins,
    sum(case when home_score = away_score then 1 else 0 end)::bigint as draws,
    sum(case
      when (home_team_id in (select team_id from public.event_team_members where user_id = target_user_id) and home_score < away_score)
        or (away_team_id in (select team_id from public.event_team_members where user_id = target_user_id) and away_score < home_score)
      then 1 else 0 end)::bigint as losses,
    sum(case
      when scoring_system = 'chess' then case when home_team_id in (select team_id from public.event_team_members where user_id = target_user_id) then home_score else away_score end
      when scoring_system = 'points' then case when home_team_id in (select team_id from public.event_team_members where user_id = target_user_id) then coalesce(home_score, 0) else coalesce(away_score, 0) end
      else case
        when (home_team_id in (select team_id from public.event_team_members where user_id = target_user_id) and home_score > away_score)
          or (away_team_id in (select team_id from public.event_team_members where user_id = target_user_id) and away_score > home_score) then 3
        when home_score = away_score then 1 else 0
      end
    end)::numeric as points
  from matches
),
teams as (
  select count(distinct etm.team_id)::bigint as teams_count
  from public.event_team_members etm
  join public.event_teams et on et.id = etm.team_id
  join public.events e on e.id = et.event_id
  where etm.user_id = target_user_id
    and e.visibility = 'public'
    and e.status in ('published', 'preparing', 'live', 'finished')
),
org as (
  select count(*)::bigint as organized_events
  from public.events
  where visibility = 'public'
    and status in ('published', 'preparing', 'live', 'finished')
    and created_by = target_user_id
)
select
  p.id,
  coalesce(p.display_name, p.username, 'Jugador'),
  p.username,
  coalesce(parts.events_played, 0),
  coalesce(rec.wins, 0),
  coalesce(rec.draws, 0),
  coalesce(rec.losses, 0),
  coalesce(rec.points, 0),
  coalesce(org.organized_events, 0),
  coalesce(teams.teams_count, 0)
from public.profiles p, parts, rec, org, teams
where p.id = target_user_id
  and (
    exists (
      select 1
      from public.events e
      where e.visibility = 'public'
        and e.status in ('published', 'preparing', 'live', 'finished')
        and (
          e.created_by = target_user_id
          or exists (
            select 1
            from public.event_participants ep
            where ep.event_id = e.id
              and ep.user_id = target_user_id
              and ep.status = 'yes'
          )
          or exists (
            select 1
            from public.event_teams et
            join public.event_team_members etm on etm.team_id = et.id
            where et.event_id = e.id
              and etm.user_id = target_user_id
          )
        )
    )
  );
$function$;
