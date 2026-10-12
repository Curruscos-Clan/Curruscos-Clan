CREATE INDEX IF NOT EXISTS reports_resolved_by_idx ON public.reports (resolved_by) WHERE resolved_by IS NOT NULL;
