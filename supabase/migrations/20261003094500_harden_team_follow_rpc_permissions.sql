-- Team follow mutations are authenticated-only.
REVOKE EXECUTE ON FUNCTION public.follow_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_team(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.unfollow_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unfollow_team(uuid) TO authenticated;
