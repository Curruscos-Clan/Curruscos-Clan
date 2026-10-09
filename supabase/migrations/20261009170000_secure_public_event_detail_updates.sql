-- La edición se ejecuta con privilegios controlados dentro de la función,
-- pero solo permite modificar eventos públicos cuyo creador sea el usuario.
alter function public.update_public_event_details(
  uuid, text, text, date, time without time zone, text, text, text, text,
  integer, numeric, timestamp with time zone, text
) security definer;

alter function public.update_public_event_details(
  uuid, text, text, date, time without time zone, text, text, text, text,
  integer, numeric, timestamp with time zone, text
) set search_path = '';