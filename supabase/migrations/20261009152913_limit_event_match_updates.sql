-- Result-writing RPCs validate scores and organizer permissions.
-- Remove the direct UPDATE path that would bypass those validations.
DROP POLICY IF EXISTS "Event creator or group admin updates matches"
  ON public.event_matches;
