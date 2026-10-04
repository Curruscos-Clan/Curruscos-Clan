-- Restrict personalized/internal SECURITY DEFINER RPCs that must not be callable anonymously.
-- Public discovery RPCs intentionally remain available to anon.

revoke execute on function public.get_social_activity() from public;
grant execute on function public.get_social_activity() to authenticated;

revoke execute on function public.get_team_follow_status(uuid) from public;
grant execute on function public.get_team_follow_status(uuid) to authenticated;

revoke execute on function public.is_public_event_organizer(uuid) from public;
grant execute on function public.is_public_event_organizer(uuid) to authenticated;
