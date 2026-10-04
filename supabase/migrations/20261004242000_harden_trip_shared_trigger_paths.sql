-- Harden shared trip/workspace trigger functions.
alter function public.enforce_group_plan_limits() set search_path = '';
alter function public.prevent_cross_workspace_parent_move() set search_path = '';
