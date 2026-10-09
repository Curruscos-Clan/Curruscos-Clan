create or replace function public.update_public_event_details(
  target_event_id uuid,
  target_title text,
  target_description text,
  target_date date,
  target_time time without time zone,
  target_location text,
  target_category text,
  target_event_type text,
  target_organizer_name text,
  target_capacity integer,
  target_entry_fee numeric,
  target_registration_deadline timestamp with time zone,
  target_rules text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  current_event public.events%rowtype;
  confirmed_count integer;
  event_start timestamp without time zone;
begin
  if actor is null then
    raise exception 'Necesitas iniciar sesión.';
  end if;

  if target_title is null or length(btrim(target_title)) = 0 or length(target_title) > 120 then
    raise exception 'El título debe tener entre 1 y 120 caracteres.';
  end if;
  if target_description is not null and length(target_description) > 2000 then
    raise exception 'La descripción no puede superar los 2000 caracteres.';
  end if;
  if target_location is not null and length(target_location) > 160 then
    raise exception 'El lugar no puede superar los 160 caracteres.';
  end if;
  if target_organizer_name is not null and length(target_organizer_name) > 120 then
    raise exception 'El nombre del organizador no puede superar los 120 caracteres.';
  end if;
  if target_rules is not null and length(target_rules) > 4000 then
    raise exception 'Las reglas no pueden superar los 4000 caracteres.';
  end if;
  if target_date is null or (target_date + coalesce(target_time, time '23:59')) <= (now() at time zone 'Europe/Madrid') then
    raise exception 'La fecha del evento debe estar en el futuro.';
  end if;
  if target_capacity is not null and target_capacity < 1 then
    raise exception 'Las plazas deben ser un número positivo.';
  end if;
  if target_entry_fee is null or target_entry_fee < 0 then
    raise exception 'El precio no puede ser negativo.';
  end if;
  if target_category is null or target_category not in ('tournament','sport','gaming','social','activity','other') then
    raise exception 'La categoría seleccionada no es válida.';
  end if;
  if target_event_type is null or target_event_type not in ('padel','futbol','baloncesto','tenis','ajedrez','gaming','running','otro') then
    raise exception 'La actividad seleccionada no es válida.';
  end if;

  event_start := target_date + coalesce(target_time, time '23:59');
  if target_registration_deadline is not null
     and target_registration_deadline >= (event_start at time zone 'Europe/Madrid') then
    raise exception 'El cierre de inscripciones debe ser anterior al inicio del evento.';
  end if;

  select * into current_event
  from public.events
  where id = target_event_id
  for update;

  if not found or current_event.visibility <> 'public' then
    raise exception 'No se encuentra el evento público.';
  end if;
  if current_event.created_by is distinct from actor then
    raise exception 'Solo el organizador puede editar este evento.';
  end if;
  if current_event.status in ('finished','cancelled') then
    raise exception 'No se puede editar un evento finalizado o cancelado.';
  end if;

  select count(*)::integer into confirmed_count
  from public.event_participants
  where event_id = target_event_id and status = 'yes';

  if target_capacity is not null and target_capacity < confirmed_count then
    raise exception 'No puedes reducir las plazas por debajo de las % inscripciones confirmadas.', confirmed_count;
  end if;

  update public.events
  set title = btrim(target_title),
      description = nullif(btrim(coalesce(target_description, '')), ''),
      date = target_date,
      time = target_time,
      location = nullif(btrim(coalesce(target_location, '')), ''),
      category = target_category,
      event_type = target_event_type,
      organizer_name = nullif(btrim(coalesce(target_organizer_name, '')), ''),
      capacity = target_capacity,
      entry_fee = target_entry_fee,
      registration_deadline = target_registration_deadline,
      rules = nullif(btrim(coalesce(target_rules, '')), '')
  where id = target_event_id;

  return target_event_id;
end;
$function$;

revoke all on function public.update_public_event_details(uuid,text,text,date,time without time zone,text,text,text,text,integer,numeric,timestamp with time zone,text) from public;
revoke all on function public.update_public_event_details(uuid,text,text,date,time without time zone,text,text,text,text,integer,numeric,timestamp with time zone,text) from anon;
grant execute on function public.update_public_event_details(uuid,text,text,date,time without time zone,text,text,text,text,integer,numeric,timestamp with time zone,text) to authenticated;