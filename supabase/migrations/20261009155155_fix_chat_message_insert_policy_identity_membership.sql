drop policy if exists "chat messages members can insert" on public.chat_messages;

create policy "chat messages members can insert"
on public.chat_messages
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.chat_room_members m
    where m.room_id = chat_messages.room_id
      and m.user_id = (select auth.uid())
  )
  and (
    not exists (
      select 1
      from public.chat_rooms r
      join public.events e on e.id = r.event_id
      where r.id = chat_messages.room_id
        and r.type = 'event'
        and (
          select count(*)
          from public.event_participants p
          where p.event_id = e.id
            and p.status = 'yes'
        ) >= 250
    )
    or exists (
      select 1
      from public.chat_rooms r
      join public.events e on e.id = r.event_id
      where r.id = chat_messages.room_id
        and r.type = 'event'
        and (
          e.created_by = (select auth.uid())
          or exists (
            select 1
            from public.group_members gm
            where gm.group_id = e.group_id
              and gm.user_id = (select auth.uid())
              and gm.role in ('owner', 'admin')
          )
        )
    )
  )
);
