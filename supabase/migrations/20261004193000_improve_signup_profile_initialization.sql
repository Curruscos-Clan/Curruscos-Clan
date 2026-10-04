create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
    requested_username text;
    base_username text;
    candidate_username text;
    suffix text;
    counter integer:=0;
begin
    requested_username := lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
    requested_username := regexp_replace(requested_username,'[^a-z0-9_.-]','','g');
    requested_username := left(requested_username,24);

    base_username := requested_username;
    if length(base_username)<3 then
        base_username := lower(regexp_replace(split_part(coalesce(new.email,''),'@',1),'[^a-zA-Z0-9_]+','_','g'));
    end if;
    if length(trim(coalesce(base_username,'')))<3 then
        base_username := 'usuario';
    end if;
    base_username := left(base_username,24);

    candidate_username := base_username;
    suffix := substr(replace(new.id::text,'-',''),1,6);

    while exists(select 1 from public.profiles p where lower(p.username)=lower(candidate_username)) loop
        counter := counter + 1;
        candidate_username := left(base_username, greatest(3,24-length(suffix)-length(counter::text)-1)) || '_' || suffix || case when counter>1 then counter::text else '' end;
        if counter>20 then
            candidate_username := 'usuario_' || substr(replace(new.id::text,'-',''),1,12);
            exit;
        end if;
    end loop;

    insert into public.profiles(id,display_name,username)
    values(
        new.id,
        coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),
                 split_part(coalesce(new.email,''),'@',1),
                 'Usuario'),
        candidate_username
    )
    on conflict(id) do update
    set display_name=coalesce(nullif(trim(excluded.display_name),''),public.profiles.display_name);

    return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;