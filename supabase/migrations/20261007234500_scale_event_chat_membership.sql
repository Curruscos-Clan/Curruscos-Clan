-- Event chat access is membership-on-demand.
-- The RPC verifies event access and adds only the requesting user to the room.
-- Existing memberships are intentionally preserved for backwards compatibility.
create or replace function public.get_or_create_event_chat(target_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','pg_temp'
as $function$
declare
  room uuid;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id=target_event_id
      and (
        e.created_by=me
        or exists (
          select 1
          from public.event_participants p
          where p.event_id=e.id
            and p.user_id=me
            and p.status='yes'
        )
      )
  ) then
    raise exception 'No tienes acceso al chat de este evento';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('event-chat:'||target_event_id::text,0));

  select id
  into room
  from public.chat_rooms
  where event_id=target_event_id
    and type='event'
  limit 1;

  if room is null then
    insert into public.chat_rooms(type,name,event_id,created_by)
    select 'event',title,id,me
    from public.events
    where id=target_event_id
    on conflict (event_id) where type='event' do nothing;

    select id
    into room
    from public.chat_rooms
    where event_id=target_event_id
      and type='event'
    limit 1;
  end if;

  insert into public.chat_room_members(room_id,user_id)
  values(room,me)
  on conflict do nothing;

  return room;
end;
$function$;

revoke execute on function public.get_or_create_event_chat(uuid) from public, anon;
grant execute on function public.get_or_create_event_chat(uuid) to authenticated;
