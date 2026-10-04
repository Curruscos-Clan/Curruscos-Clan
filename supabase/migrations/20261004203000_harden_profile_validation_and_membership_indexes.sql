-- CURRUSCOS — harden profile validation and membership indexes
-- Mirrors the live database hardening applied on 2026-10-04.
alter table public.profiles
  drop constraint if exists profiles_username_format_check,
  drop constraint if exists profiles_display_name_length_check;

alter table public.profiles
  add constraint profiles_username_format_check
  check (
    username is null
    or username ~ '^[a-z0-9_.-]{3,24}$'
  ),
  add constraint profiles_display_name_length_check
  check (
    display_name is null
    or char_length(btrim(display_name)) between 2 and 60
  );

create index if not exists idx_group_members_user_group
  on public.group_members (user_id, group_id);

create index if not exists idx_group_members_group_user
  on public.group_members (group_id, user_id);
