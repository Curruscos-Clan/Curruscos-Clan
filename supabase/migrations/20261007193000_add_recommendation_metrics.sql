-- Aggregate recommendation funnel metrics without exposing raw impression rows.
CREATE OR REPLACE FUNCTION public.get_my_recommendation_metrics(target_days integer DEFAULT 30)
RETURNS TABLE(
  impressions bigint,
  unique_events_impressed bigint,
  viewed bigint,
  saved bigint,
  joined bigint,
  dismissed bigint,
  view_rate numeric,
  save_rate numeric,
  join_rate numeric,
  dismiss_rate numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth','pg_temp'
AS $function$
with params as (
  select greatest(1,least(365,coalesce(target_days,30)))::integer days
),
impressions_base as (
  select i.id,i.user_id,i.event_id,i.created_at
  from public.recommendation_impressions i
  where i.user_id=auth.uid()
    and i.created_at >= now() - make_interval(days => (select days from params))
),
metrics as (
  select
    count(*)::bigint impressions,
    count(distinct i.event_id)::bigint unique_events_impressed,
    count(distinct i.id) filter (where exists (
      select 1 from public.user_activity_signals s
      where s.user_id=i.user_id and s.event_id=i.event_id
        and s.signal_type='view'
        and s.created_at>=i.created_at
        and s.created_at<=i.created_at+interval '7 days'
    ))::bigint viewed,
    count(distinct i.id) filter (where exists (
      select 1 from public.user_activity_signals s
      where s.user_id=i.user_id and s.event_id=i.event_id
        and s.signal_type='save'
        and s.created_at>=i.created_at
        and s.created_at<=i.created_at+interval '7 days'
    ))::bigint saved,
    count(distinct i.event_id) filter (where exists (
      select 1 from public.user_activity_signals s
      where s.user_id=i.user_id and s.event_id=i.event_id
        and s.signal_type='join'
        and s.created_at>=i.created_at
        and s.created_at<=i.created_at+interval '7 days'
    ))::bigint joined,
    count(distinct i.event_id) filter (where exists (
      select 1 from public.user_activity_signals s
      where s.user_id=i.user_id and s.event_id=i.event_id
        and s.signal_type='dismiss'
        and s.created_at>=i.created_at
        and s.created_at<=i.created_at+interval '7 days'
    ))::bigint dismissed
  from impressions_base i
)
select impressions,unique_events_impressed,viewed,saved,joined,dismissed,
  case when impressions=0 then 0 else round(100.0*viewed/impressions,2) end,
  case when impressions=0 then 0 else round(100.0*saved/impressions,2) end,
  case when impressions=0 then 0 else round(100.0*joined/impressions,2) end,
  case when impressions=0 then 0 else round(100.0*dismissed/impressions,2) end
from metrics;
$function$;

revoke execute on function public.get_my_recommendation_metrics(integer) from anon, public;
grant execute on function public.get_my_recommendation_metrics(integer) to authenticated;
