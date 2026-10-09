drop trigger if exists trg_event_match_identity on public.event_matches;
create trigger trg_event_match_identity
before insert or update on public.event_matches
for each row execute function private.prevent_event_match_identity_changes();
