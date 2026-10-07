-- Link decisions to an optional group plan.
-- Existing group-level decisions remain valid with event_id = NULL.

alter table public.polls
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists idx_polls_event_id on public.polls(event_id);
