-- Keep invitation status transitions behind validated RPCs.
-- The response/cancellation RPCs use declined/cancelled, so the guard must permit those terminal states.
create or replace function public.prevent_invitation_routing_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.group_id is distinct from new.group_id
     or old.event_id is distinct from new.event_id
     or old.team_id is distinct from new.team_id
     or old.inviter_id is distinct from new.inviter_id
     or old.invitee_id is distinct from new.invitee_id
     or old.kind is distinct from new.kind then
    raise exception 'INVITATION_ROUTING_CHANGE_NOT_ALLOWED';
  end if;

  if old.status is distinct from new.status
     and new.status not in ('accepted', 'rejected', 'declined', 'cancelled') then
    raise exception 'INVITATION_STATUS_NOT_ALLOWED';
  end if;

  return new;
end;
$$;

drop policy if exists "invitees can update invitations" on public.invitations;

revoke execute on function public.prevent_invitation_routing_change() from public, anon, authenticated;
