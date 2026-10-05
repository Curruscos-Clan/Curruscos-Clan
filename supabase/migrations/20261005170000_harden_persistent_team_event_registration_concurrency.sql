-- Serialize persistent-team event registration on the event row so
-- concurrent registrations cannot both pass the capacity check.
create or replace function public.register_persistent_team_for_event(target_event_id uuid, target_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare actor uuid:=auth.uid(); e public.events%rowtype; t public.teams%rowtype; et uuid; member record; team_count integer; confirmed_outside_team integer;
begin
 if actor is null then raise exception 'Necesitas iniciar sesión'; end if;
 select * into e from public.events where id=target_event_id for update;
 if not found then raise exception 'Evento no encontrado'; end if;
 if e.participant_mode<>'team' then raise exception 'Este evento no utiliza equipos'; end if;
 if e.status<>'published' then raise exception 'El evento no admite nuevas inscripciones'; end if;
 if e.registration_deadline is not null and e.registration_deadline<now() then raise exception 'Las inscripciones están cerradas'; end if;
 select t.* into t from public.teams t join public.team_members tm on tm.team_id=t.id where t.id=target_team_id and tm.user_id=actor for update;
 if not found then raise exception 'No perteneces a ese equipo'; end if;
 select count(*) into team_count from public.team_members where team_id=t.id;
 if e.team_size is not null and team_count>e.team_size then raise exception 'Tu equipo tiene más integrantes que las plazas por equipo de este evento'; end if;
 if exists(select 1 from public.event_teams where event_id=e.id and persistent_team_id=t.id) then raise exception 'Ese equipo ya está inscrito en este evento'; end if;
 if exists(select 1 from public.event_team_members etm join public.event_teams x on x.id=etm.team_id where x.event_id=e.id and etm.user_id=actor) then raise exception 'Ya perteneces a un equipo en este evento'; end if;
 if exists(select 1 from public.event_team_members etm join public.event_teams x on x.id=etm.team_id join public.team_members tm on tm.user_id=etm.user_id where x.event_id=e.id and tm.team_id=t.id) then raise exception 'Uno de los integrantes ya pertenece a otro equipo en este evento'; end if;
 select count(*) into confirmed_outside_team from public.event_participants ep where ep.event_id=e.id and ep.status='yes' and not exists(select 1 from public.team_members tm where tm.team_id=t.id and tm.user_id=ep.user_id);
 if e.capacity is not null and confirmed_outside_team+team_count>e.capacity then raise exception 'No quedan suficientes plazas para todo el equipo'; end if;
 for member in select user_id from public.team_members where team_id=t.id loop
   if not exists(select 1 from public.event_participants where event_id=e.id and user_id=member.user_id and status='yes') then
     raise exception 'Todos los miembros del equipo deben aceptar su participación en el evento antes de registrar el equipo';
   end if;
 end loop;
 insert into public.event_teams(event_id,name,persistent_team_id) values(e.id,t.name,t.id) returning id into et;
 insert into public.event_team_members(team_id,user_id) select et,user_id from public.team_members where team_id=t.id;
 return et;
end $function$;