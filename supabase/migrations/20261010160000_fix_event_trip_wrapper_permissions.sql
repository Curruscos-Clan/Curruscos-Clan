-- The public wrappers must execute with their owner's privileges because the
-- private helpers intentionally deny EXECUTE to client roles. The helpers remain
-- responsible for auth.uid(), membership/role checks, and atomic plan limits.
-- Empty search_path plus schema-qualified calls prevents object-shadowing.

ALTER FUNCTION public.create_group_event(uuid, text, text, date, time without time zone, text, uuid)
  SECURITY DEFINER;
ALTER FUNCTION public.create_group_event(uuid, text, text, date, time without time zone, text, uuid)
  SET search_path = '';

ALTER FUNCTION public.create_trip(uuid, text, text, date, date, numeric, text, jsonb)
  SECURITY DEFINER;
ALTER FUNCTION public.create_trip(uuid, text, text, date, date, numeric, text, jsonb)
  SET search_path = '';

REVOKE ALL ON FUNCTION public.create_group_event(uuid, text, text, date, time without time zone, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_event(uuid, text, text, date, time without time zone, text, uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.create_trip(uuid, text, text, date, date, numeric, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_trip(uuid, text, text, date, date, numeric, text, jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.create_group_event(uuid, text, text, date, time without time zone, text, uuid)
  IS 'Authenticated wrapper for private.create_group_event_secure; helper validates identity, membership and plan capacity.';
COMMENT ON FUNCTION public.create_trip(uuid, text, text, date, date, numeric, text, jsonb)
  IS 'Authenticated wrapper for private.create_trip_secure; helper validates identity, admin role and plan capacity.';
