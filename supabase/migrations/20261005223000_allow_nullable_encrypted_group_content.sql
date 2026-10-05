alter table public.events alter column title drop not null;
alter table public.trips alter column title drop not null;
alter table public.trips alter column search_preferences drop not null;
alter table public.trips alter column recommendations drop not null;
alter table public.trip_options alter column title drop not null;
alter table public.trip_options alter column metadata drop not null;
alter table public.trip_itinerary_items alter column title drop not null;
