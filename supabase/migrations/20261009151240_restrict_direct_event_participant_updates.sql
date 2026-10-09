-- Force attendance status changes through the SECURITY DEFINER RPC,
-- which validates event publication status, deadlines, capacity and permissions.
drop policy if exists "Users can update their participation" on public.event_participants;
