-- Prevent duplicate contextual chat rooms created by concurrent get-or-create calls.
-- Existing data was checked before applying these unique partial indexes.

create unique index if not exists chat_rooms_group_unique
  on public.chat_rooms (group_id)
  where type = 'group' and group_id is not null;

create unique index if not exists chat_rooms_event_unique
  on public.chat_rooms (event_id)
  where type = 'event' and event_id is not null;

create unique index if not exists chat_rooms_team_unique
  on public.chat_rooms (team_id)
  where type = 'team' and team_id is not null;
