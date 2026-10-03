-- Keep private social/team-member data behind authentication.
REVOKE EXECUTE ON FUNCTION public.get_persistent_team_members(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_social_activity() FROM anon;
