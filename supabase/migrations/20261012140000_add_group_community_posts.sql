-- Muro de comunidades adaptado al esquema real de Curruscos (groups/group_members).
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists community_posts_group_created_idx
  on public.community_posts (group_id, pinned desc, created_at desc);
create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 800),
  created_at timestamptz not null default now()
);
create index if not exists community_post_comments_post_created_idx
  on public.community_post_comments (post_id, created_at asc);
alter table public.community_posts enable row level security;
alter table public.community_post_comments enable row level security;

drop policy if exists "Community posts visible by group visibility" on public.community_posts;
create policy "Community posts visible by group visibility" on public.community_posts for select to anon, authenticated
using (exists (
  select 1 from public.groups g where g.id=community_posts.group_id and (
    g.visibility='public' or exists (select 1 from public.group_members gm where gm.group_id=g.id and gm.user_id=(select auth.uid()))
  )
));
drop policy if exists "Members can publish community posts" on public.community_posts;
create policy "Members can publish community posts" on public.community_posts for insert to authenticated
with check (author_id=(select auth.uid()) and exists (
  select 1 from public.group_members gm where gm.group_id=community_posts.group_id and gm.user_id=(select auth.uid())
));
drop policy if exists "Authors and group admins can delete community posts" on public.community_posts;
create policy "Authors and group admins can delete community posts" on public.community_posts for delete to authenticated
using (author_id=(select auth.uid()) or public.is_group_admin(group_id));

drop policy if exists "Community comments visible by group visibility" on public.community_post_comments;
create policy "Community comments visible by group visibility" on public.community_post_comments for select to anon, authenticated
using (exists (
  select 1 from public.community_posts cp join public.groups g on g.id=cp.group_id
  where cp.id=community_post_comments.post_id and (
    g.visibility='public' or exists (select 1 from public.group_members gm where gm.group_id=g.id and gm.user_id=(select auth.uid()))
  )
));
drop policy if exists "Members can comment on community posts" on public.community_post_comments;
create policy "Members can comment on community posts" on public.community_post_comments for insert to authenticated
with check (author_id=(select auth.uid()) and exists (
  select 1 from public.community_posts cp join public.group_members gm on gm.group_id=cp.group_id
  where cp.id=community_post_comments.post_id and gm.user_id=(select auth.uid())
));
drop policy if exists "Authors and group admins can delete community comments" on public.community_post_comments;
create policy "Authors and group admins can delete community comments" on public.community_post_comments for delete to authenticated
using (author_id=(select auth.uid()) or exists (
  select 1 from public.community_posts cp where cp.id=community_post_comments.post_id and public.is_group_admin(cp.group_id)
));
grant select on public.community_posts, public.community_post_comments to anon, authenticated;
grant insert, delete on public.community_posts, public.community_post_comments to authenticated;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_posts') then
    alter publication supabase_realtime add table public.community_posts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_post_comments') then
    alter publication supabase_realtime add table public.community_post_comments;
  end if;
end $$;
