alter function public.get_or_create_team_chat(uuid) set search_path = '';
alter function public.get_team_follow_status(uuid) set search_path = '';
alter function public.leave_event_team(uuid) set search_path = '';
alter function public.validate_event_team_member() set search_path = '';
alter function public.protect_event_team_identity_changes() set search_path = '';
alter function public.protect_event_team_member_identity_changes() set search_path = '';
