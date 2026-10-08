create or replace function public.log_activity_signal(target_signal text, target_event_id uuid default null, target_event_type text default null, target_search text default null, target_metadata jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'pg_temp'
as $function$
begin
  if auth.uid() is null then return false; end if;
  if target_signal not in ('view','search','join','leave','filter','team','share','dismiss','hide','save') then
    raise exception 'invalid signal';
  end if;
  insert into public.user_activity_signals(user_id,event_id,signal_type,event_type,search_text,metadata)
  values(auth.uid(),target_event_id,target_signal,target_event_type,target_search,coalesce(target_metadata,'{}'::jsonb));
  return true;
end
$function$;

grant execute on function public.log_activity_signal(text,uuid,text,text,jsonb) to authenticated;
revoke execute on function public.log_activity_signal(text,uuid,text,text,jsonb) from anon, public;
