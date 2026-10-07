-- Public event detail RPCs expose participant-level information.
-- Keep them available to signed-in users, but do not expose them to anonymous callers.
revoke execute on function public.get_public_event_participants(uuid) from anon, public;
revoke execute on function public.get_public_event_team_members(uuid) from anon, public;
revoke execute on function public.get_public_race_results(uuid) from anon, public;

grant execute on function public.get_public_event_participants(uuid) to authenticated;
grant execute on function public.get_public_event_team_members(uuid) to authenticated;
grant execute on function public.get_public_race_results(uuid) to authenticated;
