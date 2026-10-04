-- CURRUSCOS — harden public discovery SECURITY DEFINER functions
-- Public discovery remains intentionally callable by anon/authenticated,
-- but no longer runs with a mutable public/pg_temp search_path.
alter function public.get_public_active_people(text,text) set search_path='';
alter function public.get_public_event_participants(uuid) set search_path='';
alter function public.get_public_event_team_members(uuid) set search_path='';
alter function public.get_public_profile(uuid) set search_path='';
alter function public.get_public_profile_activity(uuid) set search_path='';
alter function public.get_public_profile_teams(uuid) set search_path='';
alter function public.get_public_rankings(text) set search_path='';

create or replace function public.get_public_team(target_team_id uuid)
returns table(team_id uuid, team_name text, event_id uuid, event_title text, event_date date, event_type text, event_status text, member_count bigint, matches_played bigint, wins bigint, draws bigint, losses bigint, points numeric)
language sql security definer
set search_path=''
as $function$
with base as (
 select et.id, et.name, e.id as eid, e.title, e.date, e.event_type, e.status
 from public.event_teams et
 join public.events e on e.id=et.event_id
 where et.id=target_team_id
   and e.visibility='public'
   and e.status in ('published','preparing','live','finished')
),
members as (
 select count(*)::bigint as n from public.event_team_members etm where etm.team_id=target_team_id
),
played as (
 select
   count(*) filter (where m.status='finished')::bigint as played,
   count(*) filter (where m.status='finished' and (
     (m.home_team_id=target_team_id and m.home_score>m.away_score) or
     (m.away_team_id=target_team_id and m.away_score>m.home_score)
   ))::bigint as wins,
   count(*) filter (where m.status='finished' and m.home_score=m.away_score)::bigint as draws,
   count(*) filter (where m.status='finished' and (
     (m.home_team_id=target_team_id and m.home_score<m.away_score) or
     (m.away_team_id=target_team_id and m.away_score<m.home_score)
   ))::bigint as losses,
   coalesce(sum(
     case
       when m.status<>'finished' then 0
       when m.home_score=m.away_score then 1
       when (m.home_team_id=target_team_id and m.home_score>m.away_score)
         or (m.away_team_id=target_team_id and m.away_score>m.home_score) then 3
       else 0
     end
   ),0)::numeric as points
 from public.event_matches m
 where m.home_team_id=target_team_id or m.away_team_id=target_team_id
)
select b.id,b.name,b.eid,b.title,b.date,b.event_type,b.status,
       members.n,played.played,played.wins,played.draws,played.losses,played.points
from base b cross join members cross join played;
$function$;

revoke execute on function public.get_public_active_people(text,text) from public;
grant execute on function public.get_public_active_people(text,text) to anon,authenticated;
revoke execute on function public.get_public_event_participants(uuid) from public;
grant execute on function public.get_public_event_participants(uuid) to anon,authenticated;
revoke execute on function public.get_public_event_team_members(uuid) from public;
grant execute on function public.get_public_event_team_members(uuid) to anon,authenticated;
revoke execute on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon,authenticated;
revoke execute on function public.get_public_profile_activity(uuid) from public;
grant execute on function public.get_public_profile_activity(uuid) to anon,authenticated;
revoke execute on function public.get_public_profile_teams(uuid) from public;
grant execute on function public.get_public_profile_teams(uuid) to anon,authenticated;
revoke execute on function public.get_public_rankings(text) from public;
grant execute on function public.get_public_rankings(text) to anon,authenticated;
revoke execute on function public.get_public_team(uuid) from public;
grant execute on function public.get_public_team(uuid) to anon,authenticated;
