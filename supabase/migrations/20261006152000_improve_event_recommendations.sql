-- Improve event recommendations with weighted, decaying signals,
-- category affinity, freshness, social proof and explicit negative feedback.
CREATE OR REPLACE FUNCTION public.get_recommended_public_events(search_text text DEFAULT NULL::text, target_event_type text DEFAULT 'all'::text)
RETURNS TABLE(event_id uuid, title text, event_type text, category text, event_date date, event_time time without time zone, location text, description text, visibility text, status text, created_by uuid, organizer_name text, participant_count bigint, score numeric)
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth','pg_temp'
AS $function$
with me as (select auth.uid() uid),
followed as (select following_id from user_follows where follower_id=(select uid from me)),
followed_teams as (select team_id from team_follows where follower_id=(select uid from me)),
interests as (select interest from user_interests where user_id=(select uid from me)),
type_affinity as (
  select event_type,sum((case signal_type when 'view' then 1 when 'save' then 4 when 'join' then 6 when 'team' then 3 when 'share' then 5 else 0 end)*greatest(0.15,1-extract(epoch from(now()-created_at))/extract(epoch from interval '90 days'))) weight
  from user_activity_signals where user_id=(select uid from me) and event_type is not null and signal_type in('view','join','team','save','share') and created_at>now()-interval '90 days' group by event_type
),
category_affinity as (
  select e.category,sum((case s.signal_type when 'view' then 1 when 'save' then 4 when 'join' then 6 when 'team' then 3 when 'share' then 5 else 0 end)*greatest(0.15,1-extract(epoch from(now()-s.created_at))/extract(epoch from interval '90 days'))) weight
  from user_activity_signals s join events e on e.id=s.event_id
  where s.user_id=(select uid from me) and e.category is not null and s.signal_type in('view','join','team','save','share') and s.created_at>now()-interval '90 days' group by e.category
),
event_affinity as (
  select event_id,sum((case signal_type when 'view' then 1 when 'save' then 5 when 'join' then 7 when 'share' then 6 else 0 end)*greatest(0.1,1-extract(epoch from(now()-created_at))/extract(epoch from interval '90 days'))) weight
  from user_activity_signals where user_id=(select uid from me) and event_id is not null and signal_type in('view','share','join','save') and created_at>now()-interval '90 days' group by event_id
),
negative_events as (
  select event_id,sum((case signal_type when 'dismiss' then 7 when 'hide' then 9 when 'leave' then 5 else 0 end)*greatest(0.2,1-extract(epoch from(now()-created_at))/extract(epoch from interval '90 days'))) weight
  from user_activity_signals where user_id=(select uid from me) and event_id is not null and signal_type in('dismiss','hide','leave') and created_at>now()-interval '90 days' group by event_id
),
negative_types as (
  select event_type,sum((case signal_type when 'dismiss' then 4 when 'hide' then 6 else 0 end)*greatest(0.2,1-extract(epoch from(now()-created_at))/extract(epoch from interval '90 days'))) weight
  from user_activity_signals where user_id=(select uid from me) and event_type is not null and signal_type in('dismiss','hide') and created_at>now()-interval '90 days' group by event_type
),
candidates as (
  select e.id,e.title,e.event_type,e.category,e.date,e.time,e.location,e.description,e.visibility,e.status,e.created_by,coalesce(p.display_name,p.username,'Organizador') organizer_name,
  (select count(*) from event_participants ep where ep.event_id=e.id and ep.status='yes') participant_count,
  ((case when e.created_by in(select following_id from followed) then 80 else 0 end)
  +(case when exists(select 1 from event_teams et where et.event_id=e.id and et.persistent_team_id in(select team_id from followed_teams)) then 100 else 0 end)
  +(case when e.event_type in(select interest from interests) then 70 else 0 end)
  +(case when e.category in(select interest from interests) then 45 else 0 end)
  +(case when e.event_type in(select event_type from type_affinity) then least(55,5*(select weight from type_affinity t where t.event_type=e.event_type)) else 0 end)
  +(case when e.category in(select category from category_affinity) then least(35,3*(select weight from category_affinity c where c.category=e.category)) else 0 end)
  +(case when e.id in(select event_id from event_affinity) then least(45,8*(select weight from event_affinity a where a.event_id=e.id)) else 0 end)
  -(case when e.id in(select event_id from negative_events) then least(100,12*(select weight from negative_events n where n.event_id=e.id)) else 0 end)
  -(case when e.event_type in(select event_type from negative_types) then least(45,6*(select weight from negative_types n where n.event_type=e.event_type)) else 0 end)
  +(case when e.status='live' then 35 else 0 end)
  +(case when e.date>=current_date then greatest(0,45-least(45,3*(e.date-current_date))) else 0 end)
  +(least(15,round(sqrt(greatest(0,(select count(*) from event_participants ep3 where ep3.event_id=e.id and ep3.status='yes')))*3)))
  +(case when e.capacity is not null then greatest(0,8-least(8,(e.capacity-(select count(*) from event_participants ep4 where ep4.event_id=e.id and ep4.status='yes')))) else 0 end))::numeric score
  from events e left join profiles p on p.id=e.created_by
  where e.visibility='public' and e.status in('published','preparing','live') and(e.date>=current_date or e.status='live')
  and(target_event_type='all' or e.event_type=target_event_type)
  and(search_text is null or btrim(search_text)='' or e.title ilike '%'||search_text||'%' or coalesce(e.location,'') ilike '%'||search_text||'%' or coalesce(p.display_name,p.username,'') ilike '%'||search_text||'%')
  and e.created_by<>(select uid from me)
)
select id,title,event_type,category,date,time,location,description,visibility,status,created_by,organizer_name,participant_count,score
from candidates where score>0 order by score desc,date asc nulls last,participant_count desc limit 24;
$function$;