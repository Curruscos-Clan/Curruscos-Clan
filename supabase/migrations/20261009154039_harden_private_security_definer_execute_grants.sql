revoke execute on function private.cancel_group_invitation_secure(uuid) from public, anon;
grant execute on function private.cancel_group_invitation_secure(uuid) to authenticated;

revoke execute on function private.get_group_pending_invitations(uuid) from public, anon;
grant execute on function private.get_group_pending_invitations(uuid) to authenticated;

revoke execute on function private.create_group_event_secure(text,text,date,time without time zone,text,uuid) from public, anon;
grant execute on function private.create_group_event_secure(text,text,date,time without time zone,text,uuid) to authenticated;

revoke execute on function private.prevent_last_owner_removal() from public, anon, authenticated;
revoke execute on function private.sync_event_trip_participant() from public, anon, authenticated;
