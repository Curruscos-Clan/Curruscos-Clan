-- Harden trip trigger functions against search_path manipulation.
alter function public.seed_trip_participant() set search_path = '';
alter function public.touch_trip_updated_at() set search_path = '';
