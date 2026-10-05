-- Public device keys used by the client to wrap per-group encryption keys.
create table if not exists public.user_e2ee_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_key_jwk jsonb not null,
  algorithm text not null default 'ECDH-P256',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_e2ee_keys enable row level security;

create policy "e2ee public keys visible to authenticated"
on public.user_e2ee_keys
for select to authenticated
using (true);

create policy "e2ee public key own insert"
on public.user_e2ee_keys
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "e2ee public key own update"
on public.user_e2ee_keys
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
