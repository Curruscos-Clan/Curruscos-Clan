-- Harden community publishing against client-supplied pinned flags.
-- Ordinary members may create posts, but cannot pin them by forging the payload.
drop policy if exists "Members can publish community posts" on public.community_posts;
create policy "Members can publish community posts"
  on public.community_posts
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and pinned = false
    and exists (
      select 1
      from public.group_members gm
      where gm.group_id = community_posts.group_id
        and gm.user_id = (select auth.uid())
    )
  );

-- Keep titles within the same limit enforced by the current community UI.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_posts_title_length_check'
      and conrelid = 'public.community_posts'::regclass
  ) then
    alter table public.community_posts
      add constraint community_posts_title_length_check
      check (title is null or char_length(title) <= 120);
  end if;
end
$$;
