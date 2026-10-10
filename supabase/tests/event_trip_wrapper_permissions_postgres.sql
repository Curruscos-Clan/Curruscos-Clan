-- Isolated PostgreSQL regression test for the wrapper permission migration.
-- Run only in a disposable database as a superuser.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.create_group_event_secure(uuid,text,text,date,time without time zone,text,uuid)
RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
CREATE OR REPLACE FUNCTION private.create_trip_secure(uuid,text,text,date,date,numeric,text,jsonb)
RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';

REVOKE ALL ON FUNCTION private.create_group_event_secure(uuid,text,text,date,time without time zone,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.create_trip_secure(uuid,text,text,date,date,numeric,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_group_event(uuid,text,text,date,time without time zone,text,uuid)
RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
CREATE OR REPLACE FUNCTION public.create_trip(uuid,text,text,date,date,numeric,text,jsonb)
RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';

\i supabase/migrations/20261009190000_fix_event_trip_wrapper_permissions.sql

DO $test$
DECLARE
  event_oid oid := 'public.create_group_event(uuid,text,text,date,time without time zone,text,uuid)'::regprocedure;
  trip_oid oid := 'public.create_trip(uuid,text,text,date,date,numeric,text,jsonb)'::regprocedure;
  event_helper oid := 'private.create_group_event_secure(uuid,text,text,date,time without time zone,text,uuid)'::regprocedure;
  trip_helper oid := 'private.create_trip_secure(uuid,text,text,date,date,numeric,text,jsonb)'::regprocedure;
BEGIN
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = event_oid)
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = trip_oid) THEN
    RAISE EXCEPTION 'Both wrappers must be SECURITY DEFINER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    CROSS JOIN LATERAL unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg(setting)
    WHERE p.oid = event_oid AND cfg.setting IN ('search_path=', 'search_path=""')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p
    CROSS JOIN LATERAL unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg(setting)
    WHERE p.oid = trip_oid AND cfg.setting IN ('search_path=', 'search_path=""')
  ) THEN
    RAISE EXCEPTION 'Both wrappers must use an empty search_path';
  END IF;

  IF NOT has_function_privilege('authenticated', event_oid, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', trip_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role must execute both wrappers';
  END IF;
  IF has_function_privilege('anon', event_oid, 'EXECUTE')
     OR has_function_privilege('anon', trip_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role must not execute wrappers';
  END IF;
  IF has_function_privilege('authenticated', event_helper, 'EXECUTE')
     OR has_function_privilege('authenticated', trip_helper, 'EXECUTE')
     OR has_function_privilege('anon', event_helper, 'EXECUTE')
     OR has_function_privilege('anon', trip_helper, 'EXECUTE') THEN
    RAISE EXCEPTION 'Client roles must not execute private helpers directly';
  END IF;
  IF NOT has_function_privilege((SELECT proowner FROM pg_proc WHERE oid = event_oid), event_helper, 'EXECUTE')
     OR NOT has_function_privilege((SELECT proowner FROM pg_proc WHERE oid = trip_oid), trip_helper, 'EXECUTE') THEN
    RAISE EXCEPTION 'Wrapper owners must execute the private helpers';
  END IF;
END
$test$;

SELECT 'event/trip wrapper permission tests passed' AS result;
