CREATE OR REPLACE FUNCTION public.set_public_event_status(target_event_id uuid, new_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  e public.events%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  if new_status not in ('published','preparing','live','finished','cancelled') then
    raise exception 'Estado no válido';
  end if;

  select * into e
  from public.events
  where id = target_event_id
  for update;

  if not found then
    raise exception 'Evento no encontrado';
  end if;

  if not public.is_public_event_organizer(target_event_id) then
    raise exception 'No tienes permisos para gestionar este evento';
  end if;

  if new_status = 'live'
     and e.format in ('knockout','round_robin','swiss')
     and not exists (
       select 1
       from public.event_matches
       where event_id = e.id
     ) then
    raise exception 'Genera primero el cuadro o calendario';
  end if;

  if new_status = 'finished'
     and e.format in ('knockout','round_robin','swiss')
     and exists (
       select 1
       from public.event_matches
       where event_id = e.id
         and status in ('scheduled','live')
     ) then
    raise exception 'No puedes finalizar la competición mientras haya partidos pendientes';
  end if;

  update public.events
  set status = new_status
  where id = target_event_id;

  return jsonb_build_object('event_id', e.id, 'status', new_status);
end;
$function$;
