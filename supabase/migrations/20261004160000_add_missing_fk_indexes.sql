create index if not exists chat_messages_room_id_idx on public.chat_messages(room_id);
create index if not exists chat_messages_user_id_idx on public.chat_messages(user_id);
create index if not exists chat_room_members_user_id_idx on public.chat_room_members(user_id);
create index if not exists chat_rooms_created_by_idx on public.chat_rooms(created_by);
create index if not exists chat_rooms_event_id_idx on public.chat_rooms(event_id);
create index if not exists chat_rooms_group_id_idx on public.chat_rooms(group_id);
create index if not exists chat_rooms_team_id_idx on public.chat_rooms(team_id);
create index if not exists event_matches_away_team_id_idx on public.event_matches(away_team_id);
create index if not exists event_matches_home_team_id_idx on public.event_matches(home_team_id);
create index if not exists event_race_results_team_id_idx on public.event_race_results(team_id);
create index if not exists invitations_event_id_idx on public.invitations(event_id);
create index if not exists invitations_group_id_idx on public.invitations(group_id);
create index if not exists invitations_inviter_id_idx on public.invitations(inviter_id);
create index if not exists invitations_team_id_idx on public.invitations(team_id);
create index if not exists trip_itinerary_items_created_by_idx on public.trip_itinerary_items(created_by);
create index if not exists trip_options_created_by_idx on public.trip_options(created_by);
create index if not exists trips_created_by_idx on public.trips(created_by);

drop index if exists public.idx_events_created_by;
