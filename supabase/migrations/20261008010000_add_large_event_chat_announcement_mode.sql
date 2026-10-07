create or replace function public.get_event_chat_mode(target_room_id uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','auth','pg_temp'
as $function$
declare e record; me uuid:=auth.uid(); total integer;
begin
 if me is null then raise exception 'authentication required'; end if;
 select ev.id,ev.created_by,ev.group_id into e from public.chat_rooms r join public.events ev on ev.id=r.event_id where r.id=target_room_id and r.type='event';
 if e.id is null then return jsonb_build_object('isEvent',false,'largeMode',false,'canSend',true); end if;
 select count(*) into total from public.event_participants p where p.event_id=e.id and p.status='yes';
 return jsonb_build_object('isEvent',true,'largeMode',total>=250,'participantCount',total,'canSend',total<250 or e.created_by=me or exists(select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=me and gm.role in ('owner','admin')));
end;
$function$;
revoke execute on function public.get_event_chat_mode(uuid) from public,anon;
grant execute on function public.get_event_chat_mode(uuid) to authenticated;

drop policy if exists "chat messages members can insert" on public.chat_messages;
create policy "chat messages members can insert" on public.chat_messages for insert to authenticated
with check (
 user_id=(select auth.uid())
 and exists(select 1 from public.chat_room_members m where m.room_id=chat_messages.room_id and m.user_id=(select auth.uid()))
 and (
   not exists(select 1 from public.chat_rooms r join public.events e on e.id=r.event_id where r.id=chat_messages.room_id and r.type='event' and (select count(*) from public.event_participants p where p.event_id=e.id and p.status='yes')>=250)
   or exists(select 1 from public.chat_rooms r join public.events e on e.id=r.event_id where r.id=chat_messages.room_id and r.type='event' and (e.created_by=(select auth.uid()) or exists(select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=(select auth.uid()) and gm.role in ('owner','admin'))))
 )
);
