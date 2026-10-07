-- Link a closed plan decision to the task it generated.
-- Nullable so existing decisions remain fully compatible.
alter table public.polls
    add column if not exists action_task_id uuid references public.tasks(id) on delete set null;

create index if not exists idx_polls_action_task_id
    on public.polls(action_task_id);
