-- Split-Bote ledger. Entries are informational and do not transfer money.
CREATE TABLE IF NOT EXISTS public.event_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 1 AND 160),
  amount numeric(10,2) NOT NULL CHECK (amount > 0 AND amount <= 100000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_expenses_select_participants ON public.event_expenses;
CREATE POLICY event_expenses_select_participants ON public.event_expenses
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.event_participants ep WHERE ep.event_id = event_expenses.event_id AND ep.user_id = (SELECT auth.uid()) AND ep.status = 'yes')
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_expenses.event_id AND e.created_by = (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS event_expenses_insert_participants ON public.event_expenses;
CREATE POLICY event_expenses_insert_participants ON public.event_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.event_participants ep WHERE ep.event_id = event_expenses.event_id AND ep.user_id = (SELECT auth.uid()) AND ep.status = 'yes')
    AND EXISTS (SELECT 1 FROM public.event_participants ep WHERE ep.event_id = event_expenses.event_id AND ep.user_id = event_expenses.payer_id AND ep.status = 'yes')
  );
DROP POLICY IF EXISTS event_expenses_delete_creator_or_organizer ON public.event_expenses;
CREATE POLICY event_expenses_delete_creator_or_organizer ON public.event_expenses
  FOR DELETE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_expenses.event_id AND e.created_by = (SELECT auth.uid()))
  );
GRANT SELECT, INSERT, DELETE ON public.event_expenses TO authenticated;
REVOKE ALL ON public.event_expenses FROM anon;
CREATE INDEX IF NOT EXISTS event_expenses_event_created_idx ON public.event_expenses(event_id, created_at DESC);
COMMENT ON TABLE public.event_expenses IS 'SplitPot expense ledger; does not execute payments or prove a transfer occurred.';
