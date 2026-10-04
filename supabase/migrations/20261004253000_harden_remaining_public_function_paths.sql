-- Harden remaining public SECURITY DEFINER search paths.
-- Keep the existing behavior while preventing resolution through an untrusted
-- default/public-only search path.
alter function public.get_recommended_public_events(text,text)
  set search_path='pg_catalog','public','auth','pg_temp';

alter function public.is_public_event_organizer(uuid)
  set search_path='pg_catalog','public','auth','pg_temp';
