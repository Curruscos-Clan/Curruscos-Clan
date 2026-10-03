-- Smart travel discovery preferences and cached recommendation payload.
alter table public.trips
  add column if not exists search_preferences jsonb not null default '{}'::jsonb,
  add column if not exists recommendations jsonb not null default '[]'::jsonb,
  add column if not exists recommendations_updated_at timestamptz;

create index if not exists trips_search_preferences_gin
  on public.trips using gin (search_preferences);
