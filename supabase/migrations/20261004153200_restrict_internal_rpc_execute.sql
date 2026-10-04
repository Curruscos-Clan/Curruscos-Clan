-- Keep public discovery RPCs public, but close authenticated-only/internal helpers
-- to anonymous callers. These functions run as SECURITY DEFINER.
revoke execute on function public.get_chat_people(text) from anon;
revoke execute on function public.get_social_activity() from anon;
revoke execute on function public.is_public_event_organizer(uuid) from anon;
