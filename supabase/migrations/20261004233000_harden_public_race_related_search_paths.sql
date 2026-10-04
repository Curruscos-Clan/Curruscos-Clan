-- Harden public discovery SECURITY DEFINER search paths.
-- The function bodies already qualify public objects explicitly; pin the
-- search_path to an empty path so unqualified objects cannot be injected
-- through a writable schema such as pg_temp.

alter function public.get_public_race_results(uuid)
  set search_path = '';

alter function public.get_public_related_events(uuid)
  set search_path = '';
