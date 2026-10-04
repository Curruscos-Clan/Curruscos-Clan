create or replace function public.validate_event_team_reference()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare team_event uuid;
begin
  if new.home_team_id is not null then
    select event_id into team_event from public.event_teams where id=new.home_team_id;
    if team_event is distinct from new.event_id then raise exception 'HOME_TEAM_EVENT_MISMATCH'; end if;
  end if;
  if new.away_team_id is not null then
    select event_id into team_event from public.event_teams where id=new.away_team_id;
    if team_event is distinct from new.event_id then raise exception 'AWAY_TEAM_EVENT_MISMATCH'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_event_match_team_reference on public.event_matches;
create trigger validate_event_match_team_reference
before insert or update on public.event_matches
for each row execute function public.validate_event_team_reference();

create or replace function public.protect_event_match_event_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.event_id is distinct from new.event_id then
    raise exception 'EVENT_MATCH_EVENT_CHANGE_NOT_ALLOWED';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_match_event_change on public.event_matches;
create trigger protect_event_match_event_change
before update on public.event_matches
for each row execute function public.protect_event_match_event_change();

create or replace function public.validate_event_team_member_event()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare old_event uuid; new_event uuid;
begin
  if tg_op='UPDATE' and old.team_id is distinct from new.team_id then
    select event_id into old_event from public.event_teams where id=old.team_id;
    select event_id into new_event from public.event_teams where id=new.team_id;
    if old_event is distinct from new_event then
      raise exception 'EVENT_TEAM_MEMBER_CROSS_EVENT_MOVE_NOT_ALLOWED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_team_member_cross_event on public.event_team_members;
create trigger protect_event_team_member_cross_event
before update on public.event_team_members
for each row execute function public.validate_event_team_member_event();

create or replace function public.protect_event_race_result_routing()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare team_event uuid;
begin
  if old.event_id is distinct from new.event_id then
    raise exception 'RACE_RESULT_EVENT_CHANGE_NOT_ALLOWED';
  end if;
  if new.team_id is not null then
    select event_id into team_event from public.event_teams where id=new.team_id;
    if team_event is distinct from new.event_id then
      raise exception 'RACE_RESULT_TEAM_EVENT_MISMATCH';
    end if;
  end if;
  if new.participant_id is not null and not exists (
    select 1 from public.event_participants ep
    where ep.event_id=new.event_id and ep.user_id=new.participant_id and ep.status='yes'
  ) then
    raise exception 'RACE_RESULT_PARTICIPANT_NOT_IN_EVENT';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_race_result_routing on public.event_race_results;
create trigger protect_event_race_result_routing
before insert or update on public.event_race_results
for each row execute function public.protect_event_race_result_routing();

revoke execute on function public.validate_event_team_reference() from public, anon, authenticated;
revoke execute on function public.protect_event_match_event_change() from public, anon, authenticated;
revoke execute on function public.validate_event_team_member_event() from public, anon, authenticated;
revoke execute on function public.protect_event_race_result_routing() from public, anon, authenticated;
