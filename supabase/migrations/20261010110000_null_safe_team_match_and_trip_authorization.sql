-- Null-safe authorization for additional SECURITY DEFINER event operations.
-- Review and apply only to a disposable development database before any production rollout.

CREATE OR REPLACE FUNCTION public.add_event_team_member(target_team_id uuid, target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  team_event_id uuid;
  e public.events%rowtype;
begin
  if actor is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  select et.event_id into team_event_id
  from public.event_teams et
  where et.id = target_team_id;

  if team_event_id is null then
    raise exception 'Equipo no encontrado';
  end if;

  select * into e
  from public.events
  where id = team_event_id
  for update;

  if not found then
    raise exception 'Evento no encontrado';
  end if;

  if not exists (
    select 1 from public.event_teams et
    where et.id = target_team_id and et.event_id = e.id
  ) then
    raise exception 'Equipo no encontrado';
  end if;

  if e.created_by is distinct from actor and not exists (
    select 1
    from public.group_members gm
    where gm.group_id = e.group_id
      and gm.user_id = actor
      and gm.role in ('owner', 'admin')
  ) then
    raise exception 'No tienes permisos para gestionar este equipo';
  end if;

  if e.participant_mode <> 'team' then
    raise exception 'Este evento usa participantes individuales';
  end if;

  if not exists (
    select 1 from public.event_participants ep
    where ep.event_id = e.id
      and ep.user_id = target_user_id
      and ep.status = 'yes'
  ) then
    raise exception 'El jugador debe estar inscrito en el evento';
  end if;

  if exists (
    select 1
    from public.event_team_members etm
    join public.event_teams et on et.id = etm.team_id
    where et.event_id = e.id
      and etm.user_id = target_user_id
      and etm.team_id <> target_team_id
  ) then
    raise exception 'El jugador ya pertenece a otro equipo en este evento';
  end if;

  insert into public.event_team_members(team_id, user_id)
  values (target_team_id, target_user_id)
  on conflict (team_id, user_id) do nothing;

  return jsonb_build_object('team_id', target_team_id, 'user_id', target_user_id);
end;
$function$;


CREATE OR REPLACE FUNCTION public.record_event_match_result(target_match_id uuid, new_home_score numeric, new_away_score numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  mat public.event_matches%rowtype;
  e public.events%rowtype;
  actor uuid := (select auth.uid());
  winner uuid;
  next_match_id uuid;
  next_match_number integer;
  next_round integer;
begin
  if actor is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  select * into mat from public.event_matches where id = target_match_id for update;
  if not found then raise exception 'Partido no encontrado'; end if;

  select * into e from public.events where id = mat.event_id;
  if not found then raise exception 'Evento no encontrado'; end if;

  if e.created_by is distinct from actor and not exists(
    select 1 from public.group_members gm
    where gm.group_id = e.group_id and gm.user_id = actor and gm.role in ('owner','admin')
  ) then
    raise exception 'No tienes permisos para registrar resultados';
  end if;

  if mat.status not in ('scheduled','live') then raise exception 'Este partido ya no admite resultados'; end if;
  if mat.home_team_id is null or mat.away_team_id is null then raise exception 'El partido no tiene dos participantes válidos'; end if;
  if new_home_score is null or new_away_score is null or new_home_score < 0 or new_away_score < 0 then raise exception 'Los resultados no son válidos'; end if;
  if e.format = 'knockout' and new_home_score = new_away_score then raise exception 'La eliminación directa necesita un ganador'; end if;

  winner := case when new_home_score > new_away_score then mat.home_team_id
                 when new_away_score > new_home_score then mat.away_team_id
                 else null end;

  update public.event_matches
  set home_score = new_home_score, away_score = new_away_score, status = 'finished'
  where id = target_match_id;

  if e.format = 'knockout' and winner is not null
     and mat.round_number < (select max(round_number) from public.event_matches where event_id = mat.event_id) then
    next_round := mat.round_number + 1;
    next_match_number := ceil(mat.match_number / 2.0)::integer;
    select id into next_match_id from public.event_matches
    where event_id = mat.event_id and round_number = next_round and match_number = next_match_number;
    if next_match_id is not null then
      update public.event_matches
      set home_team_id = case when mat.match_number % 2 = 1 then winner else home_team_id end,
          away_team_id = case when mat.match_number % 2 = 0 then winner else away_team_id end
      where id = next_match_id;
    end if;
  end if;

  return jsonb_build_object('match_id', target_match_id, 'winner_team_id', winner, 'next_match_id', next_match_id);
end;
$function$;


CREATE OR REPLACE FUNCTION public.remove_event_team_member(target_team_id uuid, target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  event_row public.events%rowtype;
begin
  if actor is null then raise exception 'Necesitas iniciar sesión'; end if;

  select ev.* into event_row
  from public.events ev
  join public.event_teams t on t.event_id = ev.id
  where t.id = target_team_id;

  if not found or event_row.created_by is distinct from actor then
    raise exception 'No tienes permisos para gestionar este equipo';
  end if;

  delete from public.event_team_members
  where team_id = target_team_id and user_id = target_user_id;

  return true;
end;
$function$;


CREATE OR REPLACE FUNCTION public.create_trip_for_event(target_event_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  e public.events%rowtype;
  gid uuid;
  tid uuid;
  v_count integer;
  v_limit integer;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into e
  from public.events
  where id = target_event_id
  for update;

  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  gid := e.group_id;

  if e.created_by is distinct from uid and not exists (
    select 1
    from public.group_members gm
    where gm.group_id = gid
      and gm.user_id = uid
      and gm.role in ('owner', 'admin')
  ) then
    raise exception 'NO_PERMISSION';
  end if;

  if e.trip_id is not null then
    return e.trip_id;
  end if;

  if gid is null then
    raise exception 'EVENT_NOT_IN_GROUP';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(gid::text, 0));

  select p.max_trips into v_limit
  from public.group_subscriptions s
  join public.workspace_plans p on p.code = s.plan_code
  where s.group_id = gid and s.status in ('trialing', 'active')
  limit 1;

  if v_limit is null then
    select max_trips into v_limit from public.workspace_plans where code = 'free';
  end if;

  select count(*) into v_count from public.trips where group_id = gid;

  if v_limit is not null and v_count >= v_limit then
    raise exception 'PLAN_LIMIT_TRIPS';
  end if;

  insert into public.trips(
    group_id, created_by, title, destination, start_date, end_date, status, description
  )
  values (gid, uid, null, null, e.date, e.date, 'planning', null)
  returning id into tid;

  update public.events set trip_id = tid where id = e.id and trip_id is null;

  insert into public.trip_participants(trip_id, user_id, status, updated_at)
  select tid, ep.user_id,
         case when ep.status = 'yes' then 'confirmed' else 'declined' end,
         now()
  from public.event_participants ep
  where ep.event_id = e.id and ep.status in ('yes', 'no')
  on conflict (trip_id, user_id)
  do update set status = excluded.status, updated_at = now();

  return tid;
end;
$function$;
