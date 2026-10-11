-- Isolated PostgreSQL behavior tests for null-safe participant authorization.
-- This test runs only in disposable GitHub Actions PostgreSQL, never production.
create schema auth;
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.events (
  id uuid primary key,
  created_by uuid,
  group_id uuid,
  visibility text,
  status text not null,
  registration_deadline timestamptz,
  capacity integer
);

create table public.group_members (
  group_id uuid not null,
  user_id uuid not null,
  role text not null,
  primary key (group_id, user_id)
);

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  user_id uuid not null,
  status text not null check (status in ('yes', 'no', 'pending')),
  unique (event_id, user_id)
);

insert into public.events (id, created_by, group_id, visibility, status, capacity) values
  ('10000000-0000-0000-0000-000000000001', null, null, 'public', 'published', 10),
  ('10000000-0000-0000-0000-000000000002', null, '20000000-0000-0000-0000-000000000001', 'private', 'published', 10),
  ('10000000-0000-0000-0000-000000000003', null, null, null, 'published', 10);

insert into public.group_members (group_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'admin');

insert into public.event_participants (event_id, user_id, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'yes'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'pending'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'yes');

\i supabase/migrations/20261010120000_null_safe_participant_status_authorization.sql

-- Recreate the unsafe anonymous row policy so the follow-up migration must remove it.
create role anon;
create role authenticated;
create function public.is_public_event_organizer(target_event_id uuid) returns boolean
language sql stable
as 'select false';
alter table public.event_participants enable row level security;
create policy "Anonymous visitors can view confirmed public event participants"
on public.event_participants for select to anon
using (
  status = 'yes'
  and exists (
    select 1 from public.events e
    where e.id = event_participants.event_id
      and e.visibility = 'public'
      and e.status in ('published','preparing','live','finished')
  )
);
-- Reproduce the legacy authenticated policy found in the current database.
-- A broad legacy SELECT policy would OR-combine with the new restricted policy.
create policy "Authenticated users can view event participation"
on public.event_participants for select to authenticated
using (true);
\i supabase/migrations/20261010140000_safe_public_event_participant_counts.sql

do $test$
declare
  caught boolean := false;
  actual_status text;
begin
  -- An ordinary user must not change another user's status when created_by is NULL.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
  begin
    perform public.set_event_participant_status(
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000003',
      'no'
    );
  exception when others then
    if sqlerrm = 'NOT_AUTHORIZED' then
      caught := true;
    else
      raise;
    end if;
  end;
  if not caught then
    raise exception 'Security regression: ordinary user changed another participant on an event with NULL creator';
  end if;

  select status into actual_status
  from public.event_participants
  where event_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-000000000003';
  if actual_status <> 'yes' then
    raise exception 'Victim participant status changed unexpectedly: %', actual_status;
  end if;

  -- A user may still change their own status on a public event.
  perform public.set_event_participant_status(
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'yes'
  );

  select status into actual_status
  from public.event_participants
  where event_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-000000000002';
  if actual_status <> 'yes' then
    raise exception 'Self-service registration failed: %', actual_status;
  end if;

  -- NULL visibility must not be treated as public by SQL three-valued logic.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
  caught := false;
  begin
    perform public.set_event_participant_status(
      '10000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004',
      'yes'
    );
  exception when others then
    if sqlerrm = 'NO_ACCESS' then
      caught := true;
    else
      raise;
    end if;
  end;
  if not caught then
    raise exception 'Security regression: self-registration was allowed when event visibility is NULL';
  end if;

  -- Group admins retain authority even when the event has no creator.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
  perform public.set_event_participant_status(
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    'no'
  );

  select status into actual_status
  from public.event_participants
  where event_id = '10000000-0000-0000-0000-000000000002'
    and user_id = '00000000-0000-0000-0000-000000000003';
  if actual_status <> 'no' then
    raise exception 'Group admin could not update participant status: %', actual_status;
  end if;

  -- The anonymous role must not retain row-level access to participant records.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_participants'
      and policyname = 'Anonymous visitors can view confirmed public event participants'
  ) then
    raise exception 'Security regression: anonymous participant row policy still exists';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_participants'
      and policyname = 'Authenticated users can view event participation'
  ) then
    raise exception 'Security regression: legacy authenticated participant row policy still exists';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_participants'
      and policyname = 'Users can view own or managed event participation'
      and qual not like '%status%'
  ) then
    raise exception 'Security regression: authenticated users still have broad participant row access';
  end if;

  -- Public aggregate counts expose only confirmed totals for public events.
  if (select participant_count
      from public.get_public_event_participant_counts(array[
        '10000000-0000-0000-0000-000000000001'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid
      ])
      where event_id = '10000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'Public confirmed participant count is incorrect';
  end if;

  if exists (
    select 1 from public.get_public_event_participant_counts(array[
      '10000000-0000-0000-0000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000002'::uuid
    ]) where event_id = '10000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'Private event participant count was exposed publicly';
  end if;

  raise notice 'Null-safe authorization and aggregate participant count integration tests passed.';
end
$test$;
