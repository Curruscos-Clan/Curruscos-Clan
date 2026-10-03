CREATE OR REPLACE FUNCTION public.get_recommended_public_events(search_text text DEFAULT NULL::text, target_event_type text DEFAULT 'all'::text)
RETURNS TABLE(event_id uuid, title text, event_type text, category text, event_date date, event_time time without time zone, location text, description text, visibility text, status text, created_by uuid, organizer_name text, participant_count bigint, score numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
with me as(select auth.uid() uid),
followed as(select following_id from user_follows where follower_id=(select uid from me)),
interests as(select interest from user_interests where user_id=(select uid from me)),
type_affinity as(
  select event_type,count(*) weight
  from user_activity_signals
  where user_id=(select uid from me) and event_type is not null
    and signal_type in('view','join','team','save') and created_at>now()-interval '90 days'
  group by event_type
),
event_affinity as(
  select event_id,count(*) weight
  from user_activity_signals
  where user_id=(select uid from me) and event_id is not null
    and signal_type in('view','share','join','save') and created_at>now()-interval '90 days'
  group by event_id
),
negative_events as(
  select event_id,count(*) weight
  from user_activity_signals
  where user_id=(select uid from me) and event_id is not null
    and signal_type in('dismiss','hide','leave') and created_at>now()-interval '90 days'
  group by event_id
),
negative_types as(
  select event_type,count(*) weight
  from user_activity_signals
  where user_id=(select uid from me) and event_type is not null
    and signal_type in('dismiss','hide') and created_at>now()-interval '90 days'
  group by event_type
),
candidates as(
  select e.id,e.title,e.event_type,e.category,e.date,e.time,e.location,e.description,e.visibility,e.status,e.created_by,
    coalesce(p.display_name,p.username,'Organizador') organizer_name,
    (select count(*) from event_participants ep where ep.event_id=e.id and ep.status='yes') participant_count,
    ((case when e.created_by in(select following_id from followed) then 80 else 0 end)
    +(case when e.event_type in(select interest from interests) then 70 else 0 end)
    +(case when e.category in(select interest from interests) then 45 else 0 end)
    +(case when e.event_type in(select event_type from type_affinity) then 25*(select weight from type_affinity t where t.event_type=e.event_type) else 0 end)
    +(case when e.id in(select event_id from event_affinity) then 20*(select weight from event_affinity a where a.event_id=e.id) else 0 end)
    -(case when e.id in(select event_id from negative_events) then 80*(select weight from negative_events n where n.event_id=e.id) else 0 end)
    -(case when e.event_type in(select event_type from negative_types) then 18*(select weight from negative_types n where n.event_type=e.event_type) else 0 end)
    +(case when e.status='live' then 50 else 0 end)
    +(case when e.date>=current_date then greatest(0,30-least(30,(e.date-current_date))) else 0 end)
    +(case when e.capacity is not null then greatest(0,10-least(10,(e.capacity-(select count(*) from event_participants ep2 where ep2.event_id=e.id and ep2.status='yes')))) else 0 end))::numeric score
  from events e left join profiles p on p.id=e.created_by
  where e.visibility='public' and e.status in('published','preparing','live')
    and (target_event_type='all' or e.event_type=target_event_type)
    and (search_text is null or btrim(search_text)='' or e.title ilike '%'||search_text||'%' or coalesce(e.location,'') ilike '%'||search_text||'%' or coalesce(p.display_name,p.username,'') ilike '%'||search_text||'%')
    and e.created_by<>(select uid from me)
)
select id,title,event_type,category,date,time,location,description,visibility,status,created_by,organizer_name,participant_count,score
from candidates where score>0
order by score desc,date asc nulls last,participant_count desc limit 24;
$function$;