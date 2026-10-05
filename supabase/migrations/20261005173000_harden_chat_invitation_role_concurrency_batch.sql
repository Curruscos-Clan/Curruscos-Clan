-- Batch hardening: chat creation races, team invitation races,
-- and group role mutation races.

create or replace function public.get_or_create_group_chat(target_group_id uuid)
returns uuid language plpgsql security definer
set search_path to 'pg_catalog','public','auth','pg_temp'
as $function$
declare room uuid; me uuid := auth.uid();
begin
 if me is null then raise exception 'authentication required'; end if;
 if not exists(select 1 from group_members where group_id=target_group_id and user_id=me) then raise exception 'No perteneces a este grupo'; end if;
 perform pg_advisory_xact_lock(hashtextextended('group-chat:'||target_group_id::text,0));
 select id into room from chat_rooms where group_id=target_group_id and type='group' limit 1;
 if room is null then
   insert into chat_rooms(type,name,group_id,created_by) values('group','Chat del grupo',target_group_id,me)
   on conflict (group_id) where type='group' do nothing;
   select id into room from chat_rooms where group_id=target_group_id and type='group' limit 1;
 end if;
 insert into chat_room_members(room_id,user_id) values(room,me) on conflict do nothing;
 insert into chat_room_members(room_id,user_id) select room,user_id from group_members where group_id=target_group_id on conflict do nothing;
 return room;
end;$function$;

create or replace function public.get_or_create_event_chat(target_event_id uuid)
returns uuid language plpgsql security definer
set search_path to 'pg_catalog','public','auth','pg_temp'
as $function$
declare room uuid; me uuid := auth.uid();
begin
 if me is null then raise exception 'authentication required'; end if;
 if not exists(select 1 from events e where e.id=target_event_id and
 (e.created_by=me or exists(select 1 from event_participants p where p.event_id=e.id and p.user_id=me and p.status='yes')))
 then raise exception 'No tienes acceso al chat de este evento'; end if;
 perform pg_advisory_xact_lock(hashtextextended('event-chat:'||target_event_id::text,0));
 select id into room from chat_rooms where event_id=target_event_id and type='event' limit 1;
 if room is null then
   insert into chat_rooms(type,name,event_id,created_by) select 'event',title,id,me from events where id=target_event_id
   on conflict (event_id) where type='event' do nothing;
   select id into room from chat_rooms where event_id=target_event_id and type='event' limit 1;
 end if;
 insert into chat_room_members(room_id,user_id) values(room,me) on conflict do nothing;
 insert into chat_room_members(room_id,user_id) select room,user_id from event_participants where event_id=target_event_id and status='yes' on conflict do nothing;
 return room;
end;$function$;

create or replace function public.get_or_create_team_chat(target_team_id uuid)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare room uuid; ev uuid; me uuid:=auth.uid();
begin
 if me is null then raise exception 'authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('team-chat:'||target_team_id::text,0));
 select event_id into ev from event_teams where id=target_team_id;
 if ev is not null then
   if not exists(select 1 from event_team_members where team_id=target_team_id and user_id=me)
      and not exists(select 1 from events where id=ev and created_by=me) then raise exception 'No tienes acceso al chat del equipo'; end if;
   select id into room from chat_rooms where team_id=target_team_id and type='team' limit 1;
   if room is null then
     insert into chat_rooms(type,name,team_id,created_by) select 'team',name,id,me from event_teams where id=target_team_id
     on conflict (team_id) where type='team' do nothing;
     select id into room from chat_rooms where team_id=target_team_id and type='team' limit 1;
   end if;
   insert into chat_room_members(room_id,user_id) values(room,me) on conflict do nothing;
   insert into chat_room_members(room_id,user_id) select room,user_id from event_team_members where team_id=target_team_id on conflict do nothing;
   return room;
 end if;
 if not exists(select 1 from teams where id=target_team_id and
   (owner_id=me or exists(select 1 from team_members where team_id=target_team_id and user_id=me)))
 then raise exception 'Equipo no encontrado o sin acceso'; end if;
 select id into room from chat_rooms where persistent_team_id=target_team_id and type='team' limit 1;
 if room is null then
   insert into chat_rooms(type,name,persistent_team_id,created_by) select 'team',name,id,me from teams where id=target_team_id
   on conflict (persistent_team_id) where type='team' do nothing;
   select id into room from chat_rooms where persistent_team_id=target_team_id and type='team' limit 1;
 end if;
 insert into chat_room_members(room_id,user_id) values(room,me) on conflict do nothing;
 insert into chat_room_members(room_id,user_id) select room,user_id from team_members where team_id=target_team_id on conflict do nothing;
 return room;
end;$function$;

create or replace function public.invite_persistent_team_to_event(target_event_id uuid,target_team_id uuid)
returns integer language plpgsql security definer set search_path to ''
as $function$
declare uid uuid:=auth.uid(); sent integer:=0; member_id uuid; event_title text; team_name text;
capacity_limit integer; event_team_size integer; confirmed integer; team_count integer; already_in_team integer; iid uuid; inviter_name text;
begin
 if uid is null then raise exception 'authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('team-event-invite:'||target_event_id::text,0));
 if not exists(select 1 from public.teams where id=target_team_id and owner_id=uid) then raise exception 'not team owner'; end if;
 select e.title,e.capacity,e.team_size into event_title,capacity_limit,event_team_size
 from public.events e where e.id=target_event_id and e.participant_mode='team' and e.status='published'
 and (e.registration_deadline is null or e.registration_deadline>=now()) for update;
 if event_title is null then raise exception 'event not available'; end if;
 select count(*) into team_count from public.team_members where team_id=target_team_id;
 if event_team_size is not null and team_count>event_team_size then raise exception 'El equipo supera el tamaño permitido por el evento'; end if;
 select count(*) into already_in_team from public.event_team_members etm join public.event_teams et on et.id=etm.team_id
 where et.event_id=target_event_id and etm.user_id in(select user_id from public.team_members where team_id=target_team_id);
 if already_in_team>0 then raise exception 'Uno de los integrantes ya pertenece a un equipo en este evento'; end if;
 select count(*) into confirmed from public.event_participants ep where ep.event_id=target_event_id and ep.status='yes'
 and not exists(select 1 from public.team_members tm where tm.team_id=target_team_id and tm.user_id=ep.user_id);
 if capacity_limit is not null and confirmed+team_count>capacity_limit then raise exception 'No quedan suficientes plazas para todo el equipo'; end if;
 select name into team_name from public.teams where id=target_team_id;
 select coalesce(display_name,username,'Alguien') into inviter_name from public.profiles where id=uid;
 for member_id in select tm.user_id from public.team_members tm where tm.team_id=target_team_id and tm.user_id<>uid loop
   if not exists(select 1 from public.event_participants ep where ep.event_id=target_event_id and ep.user_id=member_id and ep.status='yes') then
     iid:=null;
     insert into public.invitations(inviter_id,invitee_id,kind,event_id) values(uid,member_id,'event',target_event_id)
     on conflict do nothing returning id into iid;
     if iid is not null then
       insert into public.notifications(user_id,type,title,message,reference_id)
       values(member_id,'invitation','Invitación a evento',inviter_name||' te invita a participar con el equipo '||team_name||' en '||event_title||'.',iid);
       sent:=sent+1;
     end if;
   end if;
 end loop;
 return sent;
end;$function$;

create or replace function public.update_group_member_role(target_group_id uuid,target_user_id uuid,new_role text)
returns boolean language plpgsql security definer set search_path to ''
as $function$
declare actor uuid:=auth.uid(); actor_role text; target_role text;
begin
 if actor is null then raise exception 'NOT_AUTHENTICATED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_group_id::text,0));
 select role into actor_role from public.group_members where group_id=target_group_id and user_id=actor;
 if actor_role<>'owner' then raise exception 'OWNER_REQUIRED'; end if;
 if new_role not in ('admin','member') then raise exception 'INVALID_ROLE'; end if;
 select role into target_role from public.group_members where group_id=target_group_id and user_id=target_user_id for update;
 if target_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;
 if target_role='owner' then raise exception 'CANNOT_CHANGE_OWNER'; end if;
 update public.group_members set role=new_role where group_id=target_group_id and user_id=target_user_id;
 return true;
end;$function$;