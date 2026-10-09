create schema if not exists app_private;
revoke all on schema app_private from public;
revoke all on schema app_private from anon;
grant usage on schema app_private to authenticated;

alter function public.update_public_event_details(uuid,text,text,date,time without time zone,text,text,text,text,integer,numeric,timestamp with time zone,text)
  set schema app_private;

create or replace function public.update_public_event_details(
  target_event_id uuid,
  target_title text,
  target_description text,
  target_date date,
  target_time time without time zone,
  target_location text,
  target_category text,
  target_event_type text,
  target_organizer_name text,
  target_capacity integer,
  target_entry_fee numeric,
  target_registration_deadline timestamp with time zone,
  target_rules text
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select app_private.update_public_event_details(
    target_event_id,
    target_title,
    target_description,
    target_date,
    target_time,
    target_location,
    target_category,
    target_event_type,
    target_organizer_name,
    target_capacity,
    target_entry_fee,
    target_registration_deadline,
    target_rules
  );
$function$;

revoke all on function public.update_public_event_details(uuid,text,text,date,time without time zone,text,text,text,text,integer,numeric,timestamp with time zone,text) from public;
revoke all on function public.update_public_event_details(uuid,text,text,date,time without time zone,text,text,text,text,integer,numeric,timestamp with time zone,text) from anon;
grant execute on function public.update_public_event_details(uuid,text,text,date,time without time zone,text,text,text,text,integer,numeric,timestamp with time zone,text) to authenticated;
