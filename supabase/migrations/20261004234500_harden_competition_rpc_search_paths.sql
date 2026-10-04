-- Harden competition SECURITY DEFINER functions against search_path injection.
alter function public.create_event_team(uuid, text) set search_path = '';
alter function public.record_race_result(uuid, uuid, bigint, integer, numeric) set search_path = '';
