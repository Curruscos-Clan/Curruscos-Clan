create or replace function public.prevent_poll_identity_changes()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.group_id is distinct from old.group_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.event_id is distinct from old.event_id
     or new.action_task_id is distinct from old.action_task_id then
    raise exception 'Poll identity and workspace fields cannot be changed' using errcode='42501';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_poll_option_identity_changes()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.poll_id is distinct from old.poll_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Poll option identity fields cannot be changed' using errcode='42501';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_poll_vote_identity_changes()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.poll_id is distinct from old.poll_id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Poll vote identity fields cannot be changed' using errcode='42501';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_trip_participant_identity_changes()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.trip_id is distinct from old.trip_id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Trip participation identity fields cannot be changed' using errcode='42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_poll_identity_changes on public.polls;
create trigger trg_prevent_poll_identity_changes before update on public.polls
for each row execute function public.prevent_poll_identity_changes();

drop trigger if exists trg_prevent_poll_option_identity_changes on public.poll_options;
create trigger trg_prevent_poll_option_identity_changes before update on public.poll_options
for each row execute function public.prevent_poll_option_identity_changes();

drop trigger if exists trg_prevent_poll_vote_identity_changes on public.poll_votes;
create trigger trg_prevent_poll_vote_identity_changes before update on public.poll_votes
for each row execute function public.prevent_poll_vote_identity_changes();

drop trigger if exists trg_prevent_trip_participant_identity_changes on public.trip_participants;
create trigger trg_prevent_trip_participant_identity_changes before update on public.trip_participants
for each row execute function public.prevent_trip_participant_identity_changes();

revoke execute on function public.prevent_poll_identity_changes() from public, anon, authenticated;
revoke execute on function public.prevent_poll_option_identity_changes() from public, anon, authenticated;
revoke execute on function public.prevent_poll_vote_identity_changes() from public, anon, authenticated;
revoke execute on function public.prevent_trip_participant_identity_changes() from public, anon, authenticated;
