create or replace function public.record_race_result(target_event_id uuid, target_participant_id uuid, target_time_ms bigint, target_finish_position integer default null, target_points numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  e public.events%rowtype;
  rid uuid;
begin
  select * into e from public.events where id=target_event_id;
  if not found then raise exception 'Evento no encontrado'; end if;

  if not public.is_public_event_organizer(target_event_id) then
    raise exception 'No tienes permisos para registrar resultados';
  end if;

  if e.format<>'race' or e.scoring_system<>'race' then
    raise exception 'Este evento no usa clasificación por tiempo';
  end if;

  if not exists (
    select 1 from public.event_participants ep
    where ep.event_id=target_event_id
      and ep.user_id=target_participant_id
      and ep.status='yes'
  ) then
    raise exception 'El participante no pertenece al evento';
  end if;

  if target_time_ms is null or target_time_ms<0 then
    raise exception 'Tiempo no válido';
  end if;

  if target_finish_position is not null and target_finish_position<1 then
    raise exception 'Posición no válida';
  end if;

  insert into public.event_race_results(event_id,participant_id,time_ms,finish_position,points)
  values(target_event_id,target_participant_id,target_time_ms,target_finish_position,target_points)
  on conflict(event_id,participant_id) do update
    set time_ms=excluded.time_ms,
        finish_position=excluded.finish_position,
        points=excluded.points
  returning id into rid;

  return jsonb_build_object('result_id',rid);
end;
$function$;
