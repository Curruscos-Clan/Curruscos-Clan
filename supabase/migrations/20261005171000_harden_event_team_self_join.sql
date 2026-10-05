create or replace function public.join_event_team(target_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare actor uuid := (select auth.uid()); team public.event_teams%rowtype; e public.events%rowtype; member_count integer;
begin
 if actor is null then raise exception 'Necesitas iniciar sesión'; end if;
 select * into team from public.event_teams where id=target_team_id for update;
 if not found then raise exception 'Equipo no encontrado'; end if;
 select * into e from public.events where id=team.event_id for update;
 if e.participant_mode<>'team' then raise exception 'Este evento no utiliza equipos'; end if;
 if e.status<>'published' then raise exception 'El evento no admite nuevas inscripciones'; end if;
 if e.registration_deadline is not null and e.registration_deadline<now() then raise exception 'Las inscripciones están cerradas'; end if;
 if not exists(select 1 from public.event_participants where event_id=e.id and user_id=actor and status='yes') then raise exception 'Primero debes inscribirte en el evento'; end if;
 if exists(select 1 from public.event_team_members where team_id=target_team_id and user_id=actor) then
   return jsonb_build_object('team_id',target_team_id,'user_id',actor);
 end if;
 if exists(select 1 from public.event_team_members etm join public.event_teams et on et.id=etm.team_id where et.event_id=e.id and etm.user_id=actor) then
   raise exception 'Ya perteneces a un equipo en este evento';
 end if;
 select count(*) into member_count from public.event_team_members where team_id=target_team_id;
 if e.team_size is not null and member_count>=e.team_size then raise exception 'El equipo está completo'; end if;
 insert into public.event_team_members(team_id,user_id) values(target_team_id,actor);
 return jsonb_build_object('team_id',target_team_id,'user_id',actor);
end;
$function$;