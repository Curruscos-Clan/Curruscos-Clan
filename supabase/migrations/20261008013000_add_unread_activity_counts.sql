create or replace function public.get_unread_activity_counts()
returns jsonb language sql security definer set search_path to ''
as $function$
select jsonb_build_object(
 'notifications',(select count(*) from public.notifications n where n.user_id=auth.uid() and not n.is_read),
 'invitations',(select count(*) from public.invitations i where i.invitee_id=auth.uid() and i.status='pending')
);
$function$;
revoke execute on function public.get_unread_activity_counts() from public,anon;
grant execute on function public.get_unread_activity_counts() to authenticated;
