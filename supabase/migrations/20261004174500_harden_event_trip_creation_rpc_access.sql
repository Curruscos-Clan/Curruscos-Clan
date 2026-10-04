-- Event/trip creation is authenticated-only.
-- The secure RPCs enforce workspace membership and plan capacity; anonymous callers
-- must not be able to invoke their public wrappers.

revoke execute on function public.create_group_event(text,text,date,time,text,uuid) from public, anon;
revoke execute on function public.create_group_event(uuid,text,text,date,time,text,uuid) from public, anon;
revoke execute on function public.create_trip(uuid,text,text,date,date,numeric,text,jsonb) from public, anon;

grant execute on function public.create_group_event(text,text,date,time,text,uuid) to authenticated;
grant execute on function public.create_group_event(uuid,text,text,date,time,text,uuid) to authenticated;
grant execute on function public.create_trip(uuid,text,text,date,date,numeric,text,jsonb) to authenticated;
