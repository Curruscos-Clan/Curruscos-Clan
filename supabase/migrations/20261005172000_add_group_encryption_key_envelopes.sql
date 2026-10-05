-- Per-member encrypted envelopes for group E2EE keys.
-- The application encrypts the group key client-side before storing it here.
create table if not exists public.group_key_envelopes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key_version integer not null default 1 check (key_version > 0),
  encrypted_group_key text not null,
  key_algorithm text not null default 'AES-GCM',
  wrapping_algorithm text not null default 'ECDH-P256-AES-KW',
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  unique (group_id, user_id, key_version)
);

alter table public.group_key_envelopes enable row level security;

create policy "group key envelopes own member read"
on public.group_key_envelopes
for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_key_envelopes.group_id
      and gm.user_id = (select auth.uid())
  )
);

create policy "group key envelopes own member insert"
on public.group_key_envelopes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_key_envelopes.group_id
      and gm.user_id = (select auth.uid())
  )
);

create index if not exists group_key_envelopes_group_idx
  on public.group_key_envelopes(group_id);

create index if not exists group_key_envelopes_user_idx
  on public.group_key_envelopes(user_id);
