create or replace function public.get_or_create_direct_chat(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'pg_temp'
as $function$
declare room uuid; me uuid := (select auth.uid()); lock_key text;
begin
 if me is null or target_user_id is null or target_user_id=me then raise exception 'Usuario no válido'; end if;
 if not exists(select 1 from profiles where id=target_user_id) then raise exception 'Usuario no encontrado'; end if;
 lock_key := least(me::text,target_user_id::text)||':'||greatest(me::text,target_user_id::text);
 perform pg_advisory_xact_lock(hashtextextended(lock_key,0));
 select r.id into room
 from chat_rooms r
 join chat_room_members a on a.room_id=r.id and a.user_id=me
 join chat_room_members b on b.room_id=r.id and b.user_id=target_user_id
 where r.type='direct' and r.group_id is null and r.event_id is null and r.team_id is null
 limit 1;
 if room is null then
   insert into chat_rooms(type,name,created_by) values('direct',null,me) returning id into room;
   insert into chat_room_members(room_id,user_id) values(room,me),(room,target_user_id);
 end if;
 return room;
end;$function$;