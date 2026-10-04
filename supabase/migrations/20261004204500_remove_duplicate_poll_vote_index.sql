-- CURRUSCOS — remove redundant poll vote index
-- poll_votes_unique_user already enforces UNIQUE (poll_id, user_id).
drop index if exists public.poll_votes_poll_user_unique;
