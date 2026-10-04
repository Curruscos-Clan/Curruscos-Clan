-- Billing/plan access hardening.
alter table public.group_subscriptions enable row level security;
drop policy if exists group_subscriptions_member_read on public.group_subscriptions;
create policy group_subscriptions_member_read on public.group_subscriptions
for select to authenticated
using (exists(select 1 from public.group_members gm where gm.group_id=group_subscriptions.group_id and gm.user_id=(select auth.uid())));

revoke all on public.group_subscriptions from anon,authenticated;
grant select on public.group_subscriptions to authenticated;
revoke insert,update,delete on public.workspace_plans from anon,authenticated;
revoke insert,update,delete on public.group_subscriptions from anon,authenticated;

create or replace function public.get_group_usage(target_group_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_plan public.workspace_plans; v_members integer; v_events integer; v_trips integer;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
 if not exists(select 1 from public.group_members where group_id=target_group_id and user_id=auth.uid()) then raise exception 'GROUP_MEMBERSHIP_REQUIRED'; end if;
 select p.* into v_plan from public.group_subscriptions s join public.workspace_plans p on p.code=s.plan_code where s.group_id=target_group_id and s.status in ('trialing','active') limit 1;
 if v_plan.code is null then select * into v_plan from public.workspace_plans where code='free'; end if;
 select count(*) into v_members from public.group_members where group_id=target_group_id;
 select count(*) into v_events from public.events where group_id=target_group_id and created_at >= date_trunc('month',now());
 select count(*) into v_trips from public.trips where group_id=target_group_id;
 return jsonb_build_object('plan',jsonb_build_object('code',v_plan.code,'name',v_plan.name,'max_members',v_plan.max_members,'max_events_per_month',v_plan.max_events_per_month,'max_trips',v_plan.max_trips,'max_storage_mb',v_plan.max_storage_mb,'features',v_plan.features),'usage',jsonb_build_object('members',v_members,'events_this_month',v_events,'trips',v_trips));
end;
$$;
revoke all on function public.get_group_usage(uuid) from public,anon;
grant execute on function public.get_group_usage(uuid) to authenticated;
