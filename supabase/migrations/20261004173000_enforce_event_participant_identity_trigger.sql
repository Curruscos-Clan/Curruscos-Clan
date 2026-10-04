-- Enforce the existing participant identity protection trigger.
-- Direct updates may change status, but never event_id or user_id.

drop trigger if exists protect_event_participant_identity on public.event_participants;

create trigger protect_event_participant_identity
before update on public.event_participants
for each row
execute function public.protect_participant_identity_changes();
