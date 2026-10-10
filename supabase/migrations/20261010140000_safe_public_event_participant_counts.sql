-- Do not expose event_participants rows to anonymous clients just to display counts.
-- Public discovery receives aggregate confirmed counts through a narrow RPC instead.
drop policy if exists "Anonymous visitors can view confirmed public event participants"
  on public.event_participants;

-- Signed-in users also get public participant details through the narrow RPC,
-- not unrestricted table rows containing user IDs and internal metadata.
-- Remove the actual legacy authenticated policy as well; policies are OR-combined.
drop policy if exists "Authenticated users can view event participation"
  on public.event_participants;
drop policy if exists "Users can view own group or confirmed public participation"
  on public.event_participants;
create policy "Users can view own or managed event participation"
on public.event_participants
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_public_event_organizer(event_participants.event_id)
  or exists (
    select 1
    from public.events e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = event_participants.event_id
      and gm.user_id = (select auth.uid())
  )
);

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
