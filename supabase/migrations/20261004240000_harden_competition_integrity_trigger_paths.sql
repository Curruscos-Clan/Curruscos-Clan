-- Harden competition integrity triggers against search_path injection.
alter function public.protect_event_match_event_change() set search_path = '';
alter function public.validate_event_team_reference() set search_path = '';
alter function public.protect_event_race_result_routing() set search_path = '';
