ALTER POLICY reports_insert_own
  ON public.reports
  WITH CHECK ((SELECT auth.uid()) = reporter_id);

ALTER POLICY reports_select_own
  ON public.reports
  USING ((SELECT auth.uid()) = reporter_id);
