-- Prevent direct REST inserts from bypassing the atomic registration RPC.
-- New registrations must go through join_public_event(), which enforces capacity,
-- deadlines, event visibility and concurrency under a row lock.
drop policy if exists "Users can join events" on public.event_participants;
