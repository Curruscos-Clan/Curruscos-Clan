-- Allow authenticated users to create their own standalone public events.
-- Workspace/group events remain centralized through SECURITY DEFINER RPCs so
-- their membership and plan-quota checks cannot be bypassed with direct INSERTs.

DROP POLICY IF EXISTS "Authenticated users can create standalone public events"
  ON public.events;

CREATE POLICY "Authenticated users can create standalone public events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND created_by = (SELECT auth.uid())
    AND group_id IS NULL
    AND trip_id IS NULL
    AND visibility = 'public'
    AND status = 'published'
    AND char_length(trim(coalesce(title, ''))) BETWEEN 1 AND 120
    AND (capacity IS NULL OR capacity >= 1)
    AND entry_fee >= 0
    AND participant_mode IN ('individual', 'team')
    AND (
      (participant_mode = 'individual' AND team_size IS NULL)
      OR
      (participant_mode = 'team' AND team_size BETWEEN 2 AND 50)
    )
    AND encrypted_payload IS NULL
    AND encryption_version IS NULL
    AND is_hidden IS FALSE
  );
