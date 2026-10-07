-- Speed up recommendation funnel attribution lookups by user, event and signal type.
create index if not exists idx_activity_signals_user_event_type_created
on public.user_activity_signals(user_id,event_id,signal_type,created_at desc);
