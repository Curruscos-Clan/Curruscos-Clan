-- Harden workspace plan-request RPC exposure.
-- The public request endpoint is an authenticated application action; anonymous
-- callers must not be able to invoke it. The privileged implementation lives
-- in private and relies on the public wrapper's authenticated caller.
revoke all on function public.request_workspace_plan(uuid,text) from public, anon;
grant execute on function public.request_workspace_plan(uuid,text) to authenticated;

revoke all on function private.request_workspace_plan_secure(uuid,text) from public, anon, authenticated;
revoke all on function private.review_workspace_plan_request_secure(uuid,text) from public, anon, authenticated;
