CREATE OR REPLACE FUNCTION public.generate_swiss_round(target_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  e public.events%rowtype;
  next_round integer;
  team_count integer;
  participant_count integer;
  assigned_count integer;
  t record;
  chosen uuid;
  fallback_opponent uuid;
  match_no integer := 0;
  bye_given boolean := false;
begin
  if actor is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into e from public.events where id=target_event_id for update;
  if not found then raise exception 'Evento no encontrado'; end if;
  if e.created_by<>actor and not exists(select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=actor and gm.role in ('owner','admin')) then raise exception 'No tienes permisos para gestionar este torneo'; end if;
  if e.format<>'swiss' then raise exception 'El evento no usa sistema suizo'; end if;
  if exists(select 1 from public.event_matches where event_id=e.id and status in ('scheduled','live')) then raise exception 'Termina los partidos de la ronda actual antes de generar la siguiente'; end if;
  select coalesce(max(round_number),0)+1 into next_round from public.event_matches where event_id=e.id;
  select count(*) into team_count from public.event_teams where event_id=e.id;
  if e.participant_mode='team' then
    select count(*) into participant_count from public.event_participants where event_id=e.id and status='yes';
    select count(*) into assigned_count from public.event_team_members etm join public.event_teams et on et.id=etm.team_id join public.event_participants ep on ep.event_id=et.event_id and ep.user_id=etm.user_id and ep.status='yes' where et.event_id=e.id;
    if team_count<2 then raise exception 'Crea al menos dos equipos antes de generar la ronda'; end if;
    if e.team_size is not null and exists(select 1 from public.event_teams et where et.event_id=e.id and (select count(*) from public.event_team_members etm where etm.team_id=et.id)<>e.team_size) then raise exception 'Todos los equipos deben estar completos antes de empezar'; end if;
    if assigned_count<>participant_count then raise exception 'Todos los participantes deben pertenecer a un equipo'; end if;
  else
    if team_count=0 then
      insert into public.event_teams(event_id,name,seed)
      select e.id,coalesce(nullif(trim(p.display_name),''),nullif(trim(p.username),''),'Jugador')||' #'||row_number() over(order by ep.created_at),row_number() over(order by ep.created_at)
      from public.event_participants ep join public.profiles p on p.id=ep.user_id
      where ep.event_id=e.id and ep.status='yes';
      select count(*) into team_count from public.event_teams where event_id=e.id;
    end if;
  end if;
  if team_count<2 then raise exception 'Se necesitan al menos 2 participantes'; end if;
  if next_round>1 and exists(select 1 from public.event_matches where event_id=e.id and round_number=next_round-1 and status<>'finished') then raise exception 'La ronda anterior no está terminada'; end if;

  create temporary table if not exists pg_temp.swiss_pool(team_id uuid primary key,pts numeric,diff numeric,scored numeric,played integer,bye_count integer,paired boolean default false) on commit drop;
  truncate pg_temp.swiss_pool;

  insert into pg_temp.swiss_pool
  select t.id,
    coalesce(sum(case
      when m.status='finished' and m.home_team_id=t.id and m.away_team_id is not null and m.home_score>m.away_score then 3
      when m.status='finished' and m.away_team_id=t.id and m.home_team_id is not null and m.away_score>m.home_score then 3
      when m.status='finished' and m.home_team_id=t.id and m.away_team_id is not null and m.home_score=m.away_score then 1
      when m.status='finished' and m.away_team_id=t.id and m.home_team_id is not null and m.away_score=m.home_score then 1
      when m.status='finished' and ((m.home_team_id=t.id and m.away_team_id is null) or (m.away_team_id=t.id and m.home_team_id is null)) then 1
      else 0 end),0),
    coalesce(sum(case when m.home_team_id=t.id then coalesce(m.home_score,0)-coalesce(m.away_score,0) when m.away_team_id=t.id then coalesce(m.away_score,0)-coalesce(m.home_score,0) else 0 end),0),
    coalesce(sum(case when m.home_team_id=t.id then coalesce(m.home_score,0) when m.away_team_id=t.id then coalesce(m.away_score,0) else 0 end),0),
    coalesce(count(*) filter(where m.status='finished' and (m.home_team_id=t.id or m.away_team_id=t.id)),0),
    coalesce(count(*) filter(where m.status='finished' and ((m.home_team_id=t.id and m.away_team_id is null) or (m.away_team_id=t.id and m.home_team_id is null))),0)
  from public.event_teams t
  left join public.event_matches m on m.event_id=e.id and (m.home_team_id=t.id or m.away_team_id=t.id)
  where t.event_id=e.id group by t.id;

  for t in select * from pg_temp.swiss_pool order by pts desc,diff desc,scored desc,played asc,team_id loop
    if t.paired then continue; end if;
    select p.team_id into chosen from pg_temp.swiss_pool p
    where not p.paired and p.team_id<>t.team_id
      and not exists(select 1 from public.event_matches m where m.event_id=e.id and ((m.home_team_id=t.team_id and m.away_team_id=p.team_id) or (m.home_team_id=p.team_id and m.away_team_id=t.team_id)))
    order by abs(p.pts-t.pts),p.diff desc,p.scored desc,p.team_id limit 1;
    if chosen is not null then
      match_no:=match_no+1;
      insert into public.event_matches(event_id,round_number,match_number,home_team_id,away_team_id,status) values(e.id,next_round,match_no,t.team_id,chosen,'scheduled');
      update pg_temp.swiss_pool set paired=true where team_id in(t.team_id,chosen);
      chosen:=null;
    end if;
  end loop;

  while exists(select 1 from pg_temp.swiss_pool where not paired) loop
    select team_id into chosen from pg_temp.swiss_pool where not paired order by pts desc,diff desc,scored desc,played asc,team_id limit 1;
    select team_id into fallback_opponent from pg_temp.swiss_pool
    where not paired and team_id<>chosen
    order by abs(pts-(select pts from pg_temp.swiss_pool where team_id=chosen)),diff desc,scored desc,team_id limit 1;
    if fallback_opponent is null then exit; end if;
    match_no:=match_no+1;
    insert into public.event_matches(event_id,round_number,match_number,home_team_id,away_team_id,status) values(e.id,next_round,match_no,chosen,fallback_opponent,'scheduled');
    update pg_temp.swiss_pool set paired=true where team_id in(chosen,fallback_opponent);
  end loop;

  select exists(select 1 from pg_temp.swiss_pool where not paired) into bye_given;
  if bye_given then
    select team_id into chosen from pg_temp.swiss_pool where not paired order by bye_count,pts,diff,scored,team_id limit 1;
    match_no:=match_no+1;
    insert into public.event_matches(event_id,round_number,match_number,home_team_id,away_team_id,home_score,away_score,status) values(e.id,next_round,match_no,chosen,null,1,null,'finished');
  end if;

  return jsonb_build_object('round',next_round,'matches',match_no);
end;
$function$;
