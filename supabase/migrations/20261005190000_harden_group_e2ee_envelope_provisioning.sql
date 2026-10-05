create or replace function public.upsert_group_key_envelope(
  target_group_id uuid,
  target_user_id uuid,
  target_key_version integer,
  target_encrypted_group_key text,
  target_key_algorithm text default 'AES-GCM',
  target_wrapping_algorithm text default 'ECDH-P256-AES-KW'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  actor_role text;
  envelope_id uuid;
begin
  if actor is null then raise exception 'Necesitas iniciar sesión'; end if;
  if target_group_id is null or target_user_id is null or target_key_version is null or target_key_version < 1 then
    raise exception 'Datos de envelope no válidos';
  end if;
  if target_encrypted_group_key is null or length(target_encrypted_group_key) > 20000 then
    raise exception 'Envelope no válido';
  end if;

  select role into actor_role
  from public.group_members
  where group_id=target_group_id and user_id=actor;

  if actor_role is null then raise exception 'No perteneces a este grupo'; end if;

  if not exists (
    select 1 from public.group_members
    where group_id=target_group_id and user_id=target_user_id
  ) then
    raise exception 'El usuario no pertenece al grupo';
  end if;

  if target_user_id<>actor and actor_role not in ('owner','admin') then
    raise exception 'No puedes provisionar la clave de otro miembro';
  end if;

  if not exists (select 1 from public.user_e2ee_keys where user_id=target_user_id) then
    raise exception 'El usuario todavía no tiene una clave de dispositivo';
  end if;

  insert into public.group_key_envelopes(
    group_id,user_id,key_version,encrypted_group_key,key_algorithm,wrapping_algorithm,rotated_at
  )
  values(
    target_group_id,target_user_id,target_key_version,target_encrypted_group_key,
    target_key_algorithm,target_wrapping_algorithm,
    case when target_key_version>1 then now() else null end
  )
  on conflict(group_id,user_id,key_version) do update set
    encrypted_group_key=excluded.encrypted_group_key,
    key_algorithm=excluded.key_algorithm,
    wrapping_algorithm=excluded.wrapping_algorithm,
    rotated_at=excluded.rotated_at
  returning id into envelope_id;

  return envelope_id;
end;
$function$;

revoke all on function public.upsert_group_key_envelope(uuid,uuid,integer,text,text,text) from public;
grant execute on function public.upsert_group_key_envelope(uuid,uuid,integer,text,text,text) to authenticated;
