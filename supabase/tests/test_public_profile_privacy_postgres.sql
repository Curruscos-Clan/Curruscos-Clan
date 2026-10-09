-- Isolated PostgreSQL integration test for get_public_profile privacy.
-- This runs only against the disposable PostgreSQL service in GitHub Actions.
create table public.profiles (
  id uuid primary key,
  display_name text,
  username text,
  avatar_url text,
  created_at timestamptz default now()
);

create table public.events (
  id uuid primary key,
  visibility text,
  status text,
  created_by uuid,
  scoring_system text
);

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  user_id uuid,
  status text
);

create table public.event_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  round_number integer,
  match_number integer,
  home_team_id uuid,
  away_team_id uuid,
  home_score numeric,
  away_score numeric,
  scheduled_at timestamptz,
  status text,
  created_at timestamptz default now(),
  score_detail jsonb
);

create table public.event_teams (
  id uuid primary key,
  event_id uuid,
  name text,
  seed integer,
  created_at timestamptz default now(),
  persistent_team_id uuid
);

create table public.event_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid,
  user_id uuid,
  created_at timestamptz default now()
);

insert into public.profiles (id, display_name, username) values
  ('00000000-0000-0000-0000-000000000001', 'Public Organizer', 'organizer'),
  ('00000000-0000-0000-0000-000000000002', 'Private Only', 'private_only'),
  ('00000000-0000-0000-0000-000000000003', 'Confirmed Participant', 'participant'),
  ('00000000-0000-0000-0000-000000000004', 'Public Team Member', 'team_member'),
  ('00000000-0000-0000-0000-000000000005', 'Pending Participant', 'pending'),
  ('00000000-0000-0000-0000-000000000006', 'Private Team Member', 'private_team_member'),
  ('00000000-0000-0000-0000-000000000007', 'Cancelled Event Organizer', 'cancelled_organizer'),
  ('00000000-0000-0000-0000-000000000008', 'Draft Event Organizer', 'draft_organizer');

insert into public.events (id, visibility, status, created_by, scoring_system) values
  ('10000000-0000-0000-0000-000000000001', 'public', 'published', '00000000-0000-0000-0000-000000000001', 'points'),
  ('10000000-0000-0000-0000-000000000002', 'private', 'published', '00000000-0000-0000-0000-000000000002', 'points'),
  ('10000000-0000-0000-0000-000000000003', 'public', 'cancelled', '00000000-0000-0000-0000-000000000007', 'points'),
  ('10000000-0000-0000-0000-000000000004', 'public', 'draft', '00000000-0000-0000-0000-000000000008', 'points');

insert into public.event_participants (event_id, user_id, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'yes'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'pending');

insert into public.event_teams (id, event_id, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Public Team'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Private Team');

insert into public.event_team_members (team_id, user_id) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006');

-- Apply the migration under test after the minimal schema and fixtures exist.
\i supabase/migrations/20261010130000_require_public_activity_for_public_profile.sql

do $test$
declare
  n bigint;
begin
  select count(*) into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000001');
  if n <> 1 then
    raise exception 'Expected public organizer profile to remain visible; got % rows', n;
  end if;

  select organized_events into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000001');
  if n <> 1 then
    raise exception 'Expected organizer statistics to remain intact; got %', n;
  end if;

  select count(*) into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000002');
  if n <> 0 then
    raise exception 'Private-only organizer profile must not be returned; got % rows', n;
  end if;

  select count(*) into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000003');
  if n <> 1 then
    raise exception 'Confirmed participant with public activity should be visible; got % rows', n;
  end if;

  select events_played into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000003');
  if n <> 1 then
    raise exception 'Expected participant events_played=1; got %', n;
  end if;

  select count(*) into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000004');
  if n <> 1 then
    raise exception 'Member of a public event team should be visible; got % rows', n;
  end if;

  select teams_count into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000004');
  if n <> 1 then
    raise exception 'Expected team member teams_count=1; got %', n;
  end if;

  select count(*) into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000005');
  if n <> 0 then
    raise exception 'Pending participant without another public activity must not be returned; got % rows', n;
  end if;

  select count(*) into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000006');
  if n <> 0 then
    raise exception 'Private-only team member must not be returned; got % rows', n;
  end if;

  select count(*) into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000007');
  if n <> 0 then
    raise exception 'Organizer of a cancelled public event must not be returned; got % rows', n;
  end if;

  select count(*) into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000008');
  if n <> 0 then
    raise exception 'Organizer of a draft public event must not be returned; got % rows', n;
  end if;

  select count(*) into n
  from public.get_public_profile('00000000-0000-0000-0000-000000000099');
  if n <> 0 then
    raise exception 'Unknown profile ID must return no rows; got % rows', n;
  end if;

  raise notice 'Public profile privacy integration tests passed.';
end
$test$;
