-- Null-safe organizer authorization for event competition/team RPCs.
-- Apply to a disposable development database first; do not deploy to production until reviewed.

CREATE OR REPLACE FUNCTION public.generate_knockout_bracket(target_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 e public.events%rowtype; actor uuid:=(select auth.uid()); participant_ids uuid[]; team_ids uuid[];
 n integer; bracket_size integer:=2; rounds integer:=0; r integer; m integer;
 source_index integer; home_id uuid; away_id uuid; winner_id uuid; created_count integer:=0;
 team_count integer; participant_count integer; assigned_count integer;
begin
 if actor is null then raise exception 'Necesitas iniciar sesión'; end if;
 select * into e from public.events where id=target_event_id for update;
 if not found then raise exception 'Evento no encontrado'; end if;
 if e.created_by is distinct from actor and not exists(select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=actor and gm.role in ('owner','admin')) then raise exception 'No tienes permisos para generar el cuadro'; end if;
 if e.format<>'knockout' then raise exception 'El evento no usa eliminación directa'; end if;
 if exists(select 1 from public.event_matches where event_id=target_event_id) then raise exception 'El cuadro ya ha sido generado'; end if;
 select array_agg(user_id order by user_id) into participant_ids from public.event_participants where event_id=target_event_id and status='yes';
 participant_count:=coalesce(array_length(participant_ids,1),0);
 if participant_count<2 then raise exception 'Se necesitan al menos 2 participantes confirmados'; end if;

 if e.participant_mode='team' then
   select count(*) into team_count from public.event_teams where event_id=e.id;
   if team_count<2 then raise exception 'Crea al menos 2 equipos antes de generar el cuadro'; end if;
   if e.team_size is not null and exists(select 1 from public.event_teams et where et.event_id=e.id and (select count(*) from public.event_team_members etm where etm.team_id=et.id)<>e.team_size) then raise exception 'Todos los equipos deben estar completos antes de empezar'; end if;
   select count(*) into assigned_count from public.event_team_members etm join public.event_teams et on et.id=etm.team_id join public.event_participants ep on ep.event_id=et.event_id and ep.user_id=etm.user_id and ep.status='yes' where et.event_id=e.id;
   if assigned_count<>participant_count then raise exception 'Todos los participantes deben pertenecer a un equipo'; end if;
   select array_agg(id order by coalesce(seed,2147483647),id) into team_ids from public.event_teams where event_id=e.id;
   n:=array_length(team_ids,1);
 else
   select array_agg(user_id order by user_id) into participant_ids from public.event_participants where event_id=target_event_id and status='yes';
   n:=coalesce(array_length(participant_ids,1),0);
   insert into public.event_teams(event_id,name,seed)
   select target_event_id,coalesce(p.display_name,p.username,'Participante')||' #'||s.i,s.i
   from generate_subscripts(participant_ids,1) s(i)
   left join public.profiles p on p.id=participant_ids[s.i];
   select array_agg(id order by seed,id) into team_ids from public.event_teams where event_id=target_event_id;
 end if;

 bracket_size:=2; while bracket_size<n loop bracket_size:=bracket_size*2; end loop;
 m:=bracket_size; while m>1 loop rounds:=rounds+1; m:=m/2; end loop;

 for r in 1..rounds loop
   for m in 1..(bracket_size/(2^r)) loop
     home_id:=null; away_id:=null;
     if r=1 then
       source_index:=(m-1)*2+1;
       if source_index<=n then home_id:=team_ids[source_index]; end if;
       if source_index+1<=n then away_id:=team_ids[source_index+1]; end if;
     end if;
     insert into public.event_matches(event_id,round_number,match_number,home_team_id,away_team_id,status)
     values(target_event_id,r,m,home_id,away_id,case when r=1 and (home_id is null or away_id is null) then 'finished' else 'scheduled' end);
     created_count:=created_count+1;
   end loop;
 end loop;

 for r in 1..rounds-1 loop
   for m in 1..(bracket_size/(2^r)) loop
     select home_team_id,away_team_id,status into home_id,away_id,e.status from public.event_matches where event_id=target_event_id and round_number=r and match_number=m;
     if e.status='scheduled' and (home_id is null) <> (away_id is null) then
       winner_id:=coalesce(home_id,away_id);
       update public.event_matches set status='finished' where event_id=target_event_id and round_number=r and match_number=m;
       update public.event_matches
       set home_team_id=case when m%2=1 then winner_id else home_team_id end,
           away_team_id=case when m%2=0 then winner_id else away_team_id end
       where event_id=target_event_id and round_number=r+1 and match_number=ceil(m/2.0)::integer;
     end if;
   end loop;
 end loop;
 return jsonb_build_object('event_id',target_event_id,'participants',participant_count,'teams',n,'bracket_size',bracket_size,'rounds',rounds,'matches',created_count);
end; $function$


CREATE OR REPLACE FUNCTION public.generate_round_robin_schedule(target_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 e public.events%rowtype; actor uuid:=(select auth.uid()); participant_ids uuid[]; team_ids uuid[]; rot integer[];
 n integer; slots integer; rounds integer; r integer; i integer; match_no integer:=0;
 home_id uuid; away_id uuid; idx integer; last_idx integer; carry integer;
 team_count integer; participant_count integer; assigned_count integer;
begin
 if actor is null then raise exception 'Necesitas iniciar sesión'; end if;
 select * into e from public.events where id=target_event_id for update;
 if not found then raise exception 'Evento no encontrado'; end if;
 if e.created_by is distinct from actor and not exists(select 1 from public.group_members gm where gm.group_id=e.group_id and gm.user_id=actor and gm.role in ('owner','admin')) then raise exception 'No tienes permisos para generar el calendario'; end if;
 if e.format<>'round_robin' then raise exception 'El evento no usa formato de liga'; end if;
 if exists(select 1 from public.event_matches where event_id=target_event_id) then raise exception 'El calendario ya ha sido generado'; end if;

 select count(*) into participant_count from public.event_participants where event_id=target_event_id and status='yes';
 if participant_count<2 then raise exception 'Se necesitan al menos 2 participantes confirmados'; end if;

 if e.participant_mode='team' then
   select count(*) into team_count from public.event_teams where event_id=e.id;
   if team_count<2 then raise exception 'Crea al menos 2 equipos antes de generar el calendario'; end if;
   if e.team_size is not null and exists(select 1 from public.event_teams et where et.event_id=e.id and (select count(*) from public.event_team_members etm where etm.team_id=et.id)<>e.team_size) then raise exception 'Todos los equipos deben estar completos antes de empezar'; end if;
   select count(*) into assigned_count from public.event_team_members etm join public.event_teams et on et.id=etm.team_id join public.event_participants ep on ep.event_id=et.event_id and ep.user_id=etm.user_id and ep.status='yes' where et.event_id=e.id;
   if assigned_count<>participant_count then raise exception 'Todos los participantes deben pertenecer a un equipo'; end if;
   select array_agg(id order by coalesce(seed,2147483647),id) into team_ids from public.event_teams where event_id=e.id;
 else
   select array_agg(user_id order by user_id) into participant_ids from public.event_participants where event_id=target_event_id and status='yes';
   insert into public.event_teams(event_id,name,seed)
   select target_event_id,coalesce(p.display_name,p.username,'Participante')||' #'||s.i,s.i
   from generate_subscripts(participant_ids,1) s(i)
   left join public.profiles p on p.id=participant_ids[s.i];
   select array_agg(id order by seed,id) into team_ids from public.event_teams where event_id=target_event_id;
 end if;

 n:=array_length(team_ids,1);
 slots:=case when n%2=0 then n else n+1 end;
 rounds:=slots-1;
 rot:=array_fill(null::integer,array[slots]);
 rot[1]:=1;
 for i in 2..slots loop rot[i]:=case when i<=n then i else null end; end loop;

 for r in 1..rounds loop
   last_idx:=slots;
   if rot[1] is not null and rot[last_idx] is not null then
     home_id:=team_ids[rot[1]]; away_id:=team_ids[rot[last_idx]]; match_no:=match_no+1;
     insert into public.event_matches(event_id,round_number,match_number,home_team_id,away_team_id,status) values(target_event_id,r,match_no,home_id,away_id,'scheduled');
   end if;
   for i in 2..(slots/2) loop
     idx:=slots-i+1;
     if rot[i] is not null and rot[idx] is not null then
       home_id:=team_ids[rot[i]]; away_id:=team_ids[rot[idx]]; match_no:=match_no+1;
       insert into public.event_matches(event_id,round_number,match_number,home_team_id,away_team_id,status) values(target_event_id,r,match_no,home_id,away_id,'scheduled');
     end if;
   end loop;
   carry:=rot[slots];
   for i in reverse 3..slots loop rot[i]:=rot[i-1]; end loop;
   rot[2]:=carry;
 end loop;
 return jsonb_build_object('event_id',target_event_id,'teams',n,'rounds',rounds,'matches',match_no);
end; $function$


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

  if e.created_by is distinct from actor and not exists(
    select 1 from public.group_members gm
    where gm.group_id=e.group_id and gm.user_id=actor and gm.role in ('owner','admin')
  ) then raise exception 'No tienes permisos para gestionar este torneo'; end if;

  if e.format<>'swiss' then raise exception 'El evento no usa sistema suizo'; end if;

  if exists(select 1 from public.event_matches where event_id=e.id and status in ('scheduled','live')) then
    raise exception 'Termina los partidos de la ronda actual antes de generar la siguiente';
  end if;

  select coalesce(max(round_number),0)+1 into next_round from public.event_matches where event_id=e.id;
  select count(*) into team_count from public.event_teams where event_id=e.id;

  if e.participant_mode='team' then
    select count(*) into participant_count from public.event_participants where event_id=e.id and status='yes';
    select count(*) into assigned_count
    from public.event_team_members etm
    join public.event_teams et on et.id=etm.team_id
    join public.event_participants ep on ep.event_id=et.event_id and ep.user_id=etm.user_id and ep.status='yes'
    where et.event_id=e.id;

    if team_count<2 then raise exception 'Crea al menos dos equipos antes de generar la ronda'; end if;
    if e.team_size is not null and exists(
      select 1 from public.event_teams et where et.event_id=e.id
      and (select count(*) from public.event_team_members etm where etm.team_id=et.id)<>e.team_size
    ) then raise exception 'Todos los equipos deben estar completos antes de empezar'; end if;
    if assigned_count<>participant_count then raise exception 'Todos los participantes deben pertenecer a un equipo'; end if;
  else
    if team_count=0 then
      insert into public.event_teams(event_id,name,seed)
      select e.id,
        coalesce(nullif(trim(p.display_name),''),nullif(trim(p.username),''),'Jugador')||' #'||row_number() over(order by ep.created_at),
        row_number() over(order by ep.created_at)
      from public.event_participants ep
      join public.profiles p on p.id=ep.user_id
      where ep.event_id=e.id and ep.status='yes';
      select count(*) into team_count from public.event_teams where event_id=e.id;
    end if;
  end if;

  if team_count<2 then raise exception 'Se necesitan al menos 2 participantes'; end if;

  if next_round>1 and exists(
    select 1 from public.event_matches
    where event_id=e.id and round_number=next_round-1 and status<>'finished'
  ) then raise exception 'La ronda anterior no está terminada'; end if;

  create temporary table if not exists pg_temp.swiss_pool(
    team_id uuid primary key,
    pts numeric,
    diff numeric,
    scored numeric,
    played integer,
    bye_count integer,
    paired boolean default false
  ) on commit drop;
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
    coalesce(sum(case
      when m.home_team_id=t.id then coalesce(m.home_score,0)-coalesce(m.away_score,0)
      when m.away_team_id=t.id then coalesce(m.away_score,0)-coalesce(m.home_score,0)
      else 0 end),0),
    coalesce(sum(case
      when m.home_team_id=t.id then coalesce(m.home_score,0)
      when m.away_team_id=t.id then coalesce(m.away_score,0)
      else 0 end),0),
    coalesce(count(*) filter(where m.status='finished' and (m.home_team_id=t.id or m.away_team_id=t.id)),0),
    coalesce(count(*) filter(where m.status='finished' and ((m.home_team_id=t.id and m.away_team_id is null) or (m.away_team_id=t.id and m.home_team_id is null))),0)
  from public.event_teams t
  left join public.event_matches m on m.event_id=e.id and (m.home_team_id=t.id or m.away_team_id=t.id)
  where t.event_id=e.id
  group by t.id;

  for t in select * from pg_temp.swiss_pool order by pts desc,diff desc,scored desc,played asc,team_id loop
    if t.paired then continue; end if;

    select p.team_id into chosen
    from pg_temp.swiss_pool p
    where not p.paired and p.team_id<>t.team_id
      and not exists(
        select 1 from public.event_matches m
        where m.event_id=e.id
        and ((m.home_team_id=t.team_id and m.away_team_id=p.team_id)
          or (m.home_team_id=p.team_id and m.away_team_id=t.team_id))
      )
    order by abs(p.pts-t.pts),p.diff desc,p.scored desc,p.team_id
    limit 1;

    if chosen is not null then
      match_no:=match_no+1;
      insert into public.event_matches(event_id,round_number,match_number,home_team_id,away_team_id,status)
      values(e.id,next_round,match_no,t.team_id,chosen,'scheduled');
      update pg_temp.swiss_pool set paired=true where team_id in(t.team_id,chosen);
      chosen:=null;
    end if;
  end loop;

  -- If strict no-rematch pairing leaves more than one player unpaired,
  -- pair the remaining players as a last resort. A valid round is better
  -- than silently creating an incomplete round; rematches are only used
  -- when the pool makes them unavoidable.
  while exists(select 1 from pg_temp.swiss_pool where not paired) loop
    select team_id into chosen
    from pg_temp.swiss_pool
    where not paired
    order by pts desc,diff desc,scored desc,played asc,team_id
    limit 1;

    select team_id into fallback_opponent
    from pg_temp.swiss_pool
    where not paired and team_id<>chosen
    order by abs(pts-(select pts from pg_temp.swiss_pool where team_id=chosen)),
             diff desc,scored desc,team_id
    limit 1;

    if fallback_opponent is null then
      exit;
    end if;

    match_no:=match_no+1;
    insert into public.event_matches(event_id,round_number,match_number,home_team_id,away_team_id,status)
    values(e.id,next_round,match_no,chosen,fallback_opponent,'scheduled');

    update pg_temp.swiss_pool set paired=true where team_id in(chosen,fallback_opponent);
  end loop;

  select exists(select 1 from pg_temp.swiss_pool where not paired) into bye_given;
  if bye_given then
    select team_id into chosen
    from pg_temp.swiss_pool
    where not paired
    order by bye_count,pts,diff,scored,team_id
    limit 1;

    match_no:=match_no+1;
    insert into public.event_matches(
      event_id,round_number,match_number,home_team_id,away_team_id,home_score,away_score,status
    )
    values(e.id,next_round,match_no,chosen,null,1,null,'finished');
  end if;

  return jsonb_build_object('round',next_round,'matches',match_no);
end;
$function$


CREATE OR REPLACE FUNCTION public.create_event_team(target_event_id uuid, team_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); new_id uuid; clean_name text:=trim(team_name); e public.events%rowtype;
begin
 if actor is null then raise exception 'Necesitas iniciar sesión'; end if;
 select * into e from public.events where id=target_event_id;
 if not found then raise exception 'Evento no encontrado'; end if;
 if e.created_by is distinct from actor then raise exception 'No tienes permisos para gestionar este evento'; end if;
 if e.participant_mode<>'team' then raise exception 'Configura primero el evento para trabajar con equipos'; end if;
 if clean_name='' or char_length(clean_name)>80 then raise exception 'El nombre del equipo no es válido'; end if;
 insert into public.event_teams(event_id,name) values(target_event_id,clean_name) returning id into new_id;
 return new_id;
end;
$function$

