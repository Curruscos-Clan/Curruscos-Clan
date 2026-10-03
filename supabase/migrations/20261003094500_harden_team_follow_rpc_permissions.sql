-- Public clients should never be able to invoke team follow mutations anonymously.
-- The functions themselves also validate auth.uid(); this revocation adds a database-level boundary.
REVOKE EXECUTE ON FUNCTION public.follow_team(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unfollow_team(uuid) FROM anon;
