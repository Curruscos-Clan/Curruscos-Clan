-- Read-only catalog assertions for the event/trip wrapper permission fix.
-- Run against a local/test database after applying migrations; this performs no writes.
DO $$
DECLARE
  event_oid oid := 'public.create_group_event(uuid,text,text,date,time without time zone,text,uuid)'::regprocedure;
  trip_oid oid := 'public.create_trip(uuid,text,text,date,date,numeric,text,jsonb)'::regprocedure;
  event_helper oid := 'private.create_group_event_secure(uuid,text,text,date,time without time zone,text,uuid)'::regprocedure;
  trip_helper oid := 'private.create_trip_secure(uuid,text,text,date,date,numeric,text,jsonb)'::regprocedure;
  event_owner oid;
  trip_owner oid;
BEGIN
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = event_oid) THEN
    RAISE EXCEPTION 'create_group_event wrapper must be SECURITY DEFINER';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = trip_oid) THEN
    RAISE EXCEPTION 'create_trip wrapper must be SECURITY DEFINER';
  END IF;

  IF NOT (SELECT coalesce(proconfig, ARRAY[]::text[]) @> ARRAY['search_path='] FROM pg_proc WHERE oid = event_oid) THEN
    RAISE EXCEPTION 'create_group_event wrapper must use an empty search_path';
  END IF;
  IF NOT (SELECT coalesce(proconfig, ARRAY[]::text[]) @> ARRAY['search_path='] FROM pg_proc WHERE oid = trip_oid) THEN
    RAISE EXCEPTION 'create_trip wrapper must use an empty search_path';
  END IF;

  IF NOT has_function_privilege('authenticated', event_oid, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', trip_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must be able to execute both public wrappers';
  END IF;
  IF has_function_privilege('anon', event_oid, 'EXECUTE')
     OR has_function_privilege('anon', trip_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not be able to execute either public wrapper';
  END IF;
  IF has_function_privilege('authenticated', event_helper, 'EXECUTE')
     OR has_function_privilege('authenticated', trip_helper, 'EXECUTE')
     OR has_function_privilege('anon', event_helper, 'EXECUTE')
     OR has_function_privilege('anon', trip_helper, 'EXECUTE') THEN
    RAISE EXCEPTION 'private helpers must remain non-executable by client roles';
  END IF;

  SELECT proowner INTO event_owner FROM pg_proc WHERE oid = event_oid;
  SELECT proowner INTO trip_owner FROM pg_proc WHERE oid = trip_oid;
  IF NOT has_function_privilege(event_owner, event_helper, 'EXECUTE')
     OR NOT has_function_privilege(trip_owner, trip_helper, 'EXECUTE') THEN
    RAISE EXCEPTION 'wrapper owners must be able to execute their private helpers';
  END IF;
END $$;
