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
  visibility text not null,
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
  ('10000000-0000-0000-0000-000000000002', null, '20000000-0000-0000-0000-000000000001', 'private', 'published', 10);

insert into public.group_members (group_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'admin');

insert into public.event_participants (event_id, user_id, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'yes'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'pending'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'yes');

\i supabase/migrations/20261010120000_null_safe_participant_status_authorization.sql

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

  -- Group admins retain authority even when the event has no creator.
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

  raise notice 'Null-safe participant authorization integration tests passed.';
end
$test$;
