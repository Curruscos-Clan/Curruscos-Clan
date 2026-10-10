-- Do not expose event_participants rows to anonymous clients just to display counts.
-- Public discovery receives aggregate confirmed counts through a narrow RPC instead.
drop policy if exists "Anonymous visitors can view confirmed public event participants"
  on public.event_participants;

create or replace function public.get_public_event_participant_counts(target_event_ids uuid[])
returns table(event_id uuid, participant_count bigint)
language sql
stable
security definer
set search_path = ''
as $function$
  select e.id as event_id, count(ep.id)::bigint as participant_count
  from public.events e
  left join public.event_participants ep
    on ep.event_id = e.id
   and ep.status = 'yes'
  where e.id = any(target_event_ids)
    and e.visibility = 'public'
    and e.status in ('published', 'preparing', 'live', 'finished')
  group by e.id;
$function$;

revoke all on function public.get_public_event_participant_counts(uuid[]) from public;
grant execute on function public.get_public_event_participant_counts(uuid[]) to anon, authenticated;
