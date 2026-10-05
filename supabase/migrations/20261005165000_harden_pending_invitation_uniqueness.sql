-- Prevent concurrent duplicate pending invitations.
create unique index if not exists invitations_pending_group_unique
on public.invitations (inviter_id, invitee_id, group_id)
where status='pending' and kind='group' and group_id is not null;

create unique index if not exists invitations_pending_event_unique
on public.invitations (inviter_id, invitee_id, event_id)
where status='pending' and kind='event' and event_id is not null;

create unique index if not exists invitations_pending_team_unique
on public.invitations (inviter_id, invitee_id, team_id)
where status='pending' and kind='team' and team_id is not null;
