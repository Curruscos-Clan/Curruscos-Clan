create index if not exists idx_chat_room_members_user_room on public.chat_room_members(user_id,room_id);
create index if not exists idx_chat_messages_room_created on public.chat_messages(room_id,created_at desc);
create index if not exists idx_chat_messages_room_unread on public.chat_messages(room_id,created_at desc) where deleted_at is null;

create or replace function public.get_my_chat_rooms()
returns table(room_id uuid,room_type text,room_name text,group_id uuid,event_id uuid,team_id uuid,updated_at timestamptz,last_message text,last_message_at timestamptz,unread_count bigint,other_user_id uuid,other_user_name text)
language sql security definer set search_path to 'pg_catalog','public','auth','pg_temp'
as $function$
with me as (select auth.uid() uid), rooms as (
 select r.* from public.chat_rooms r join public.chat_room_members m on m.room_id=r.id join me on me.uid=m.user_id
), data as (
 select r.*,lm.body last_body,lm.created_at last_created,coalesce(uc.n,0)::bigint unread_count
 from rooms r
 left join lateral (select m.body,m.created_at from public.chat_messages m where m.room_id=r.id and m.deleted_at is null order by m.created_at desc limit 1) lm on true
 left join lateral (select count(*)::bigint n from public.chat_messages m join public.chat_room_members me_m on me_m.room_id=r.id and me_m.user_id=(select uid from me) where m.room_id=r.id and m.deleted_at is null and m.user_id<>(select uid from me) and (me_m.last_read_at is null or m.created_at>me_m.last_read_at)) uc on true
)
select d.id,d.type,d.name,d.group_id,d.event_id,d.team_id,coalesce(d.last_created,d.created_at),d.last_body,d.last_created,d.unread_count,
 case when d.type='direct' then o.user_id end,
 case when d.type='direct' then coalesce(p.display_name,p.username,'Usuario') end
from data d
left join lateral (select crm.user_id from public.chat_room_members crm where crm.room_id=d.id and crm.user_id<>(select uid from me) limit 1) o on true
left join public.profiles p on p.id=o.user_id
order by coalesce(d.last_created,d.created_at) desc;
$function$;

revoke execute on function public.get_my_chat_rooms() from public,anon;
grant execute on function public.get_my_chat_rooms() to authenticated;
