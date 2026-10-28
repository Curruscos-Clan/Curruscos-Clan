-- These RPCs are for signed-in users only. Keep SECURITY DEFINER where
-- required, but do not expose the callable surface to anonymous clients.
-- The function bodies still enforce authorization; this is defense in depth.

revoke execute on function public.create_discoverable_group(text, text, text, text)
  from public, anon;
grant execute on function public.create_discoverable_group(text, text, text, text)
  to authenticated;

revoke execute on function public.get_group_membership_requests(uuid)
  from public, anon;
grant execute on function public.get_group_membership_requests(uuid)
  to authenticated;

revoke execute on function public.join_event_atomic(uuid, uuid)
  from public, anon;
grant execute on function public.join_event_atomic(uuid, uuid)
  to authenticated;

revoke execute on function public.log_recommendation_impression(uuid, uuid, text)
  from public, anon;
grant execute on function public.log_recommendation_impression(uuid, uuid, text)
  to authenticated;

revoke execute on function public.request_group_membership(uuid)
  from public, anon;
grant execute on function public.request_group_membership(uuid)
  to authenticated;

revoke execute on function public.review_group_membership_request(uuid, boolean)
  from public, anon;
grant execute on function public.review_group_membership_request(uuid, boolean)
  to authenticated;
