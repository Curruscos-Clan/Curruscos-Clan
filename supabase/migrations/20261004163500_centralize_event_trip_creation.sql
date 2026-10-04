-- Creation of workspace events and trips is centralized in SECURITY DEFINER
-- RPCs so plan capacity and authorization cannot be bypassed with direct INSERTs.
drop policy if exists "Members or users can create events" on public.events;
drop policy if exists trips_insert_members on public.trips;
