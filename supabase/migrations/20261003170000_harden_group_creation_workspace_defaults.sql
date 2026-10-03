create or replace function private.create_group_secure(group_name text, group_description text default null)
returns public.groups
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare new_group public.groups;
begin
  if auth.uid() is null then raise exception 'Usuario no autenticado'; end if;
  if length(trim(coalesce(group_name,'')))=0 then raise exception 'El nombre del grupo es obligatorio'; end if;
  if length(trim(group_name))>80 then raise exception 'El nombre del grupo es demasiado largo'; end if;
  if length(coalesce(group_description,''))>500 then raise exception 'La descripción del grupo es demasiado larga'; end if;

  insert into public.groups(name,description,created_by,slug,timezone,default_locale,visibility)
  values (
    trim(group_name),
    nullif(trim(group_description),''),
    auth.uid(),
    lower(regexp_replace(trim(group_name),'[^a-zA-Z0-9]+','-','g')) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
    coalesce(auth.jwt()->>'timezone','Europe/Madrid'),
    coalesce(auth.jwt()->>'locale','es'),
    'private'
  ) returning * into new_group;

  insert into public.group_members(group_id,user_id,role)
  values(new_group.id,auth.uid(),'owner');

  insert into public.group_subscriptions(group_id,plan_code,status)
  values(new_group.id,'free','active')
  on conflict(group_id) do nothing;

  return new_group;
end;
$$;

revoke all on function public.create_group(text,text) from public,anon;
grant execute on function public.create_group(text,text) to authenticated;
