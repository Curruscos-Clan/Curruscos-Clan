-- Harden trip tenant/creator trigger search path.
alter function public.protect_trip_tenant_creator_changes()
set search_path = '';
