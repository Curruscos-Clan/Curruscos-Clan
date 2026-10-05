create or replace function public.enforce_e2ee_plaintext_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.encrypted_payload is not null then
    if new.encryption_version is null or new.encryption_version < 1 then raise exception 'E2EE_VERSION_REQUIRED'; end if;
    if tg_table_name = 'events' and (new.title is not null or new.description is not null or new.location is not null) then raise exception 'PLAINTEXT_E2EE_FIELDS_FORBIDDEN'; end if;
    if tg_table_name = 'memories' and (new.title is not null or new.description is not null) then raise exception 'PLAINTEXT_E2EE_FIELDS_FORBIDDEN'; end if;
    if tg_table_name = 'expenses' and new.title is not null then raise exception 'PLAINTEXT_E2EE_FIELDS_FORBIDDEN'; end if;
  elsif new.encryption_version is not null then raise exception 'E2EE_PAYLOAD_REQUIRED'; end if;
  return new;
end;
$$;
drop trigger if exists enforce_events_e2ee_plaintext_consistency on public.events;
create trigger enforce_events_e2ee_plaintext_consistency before insert or update on public.events for each row execute function public.enforce_e2ee_plaintext_consistency();
drop trigger if exists enforce_memories_e2ee_plaintext_consistency on public.memories;
create trigger enforce_memories_e2ee_plaintext_consistency before insert or update on public.memories for each row execute function public.enforce_e2ee_plaintext_consistency();
drop trigger if exists enforce_expenses_e2ee_plaintext_consistency on public.expenses;
create trigger enforce_expenses_e2ee_plaintext_consistency before insert or update on public.expenses for each row execute function public.enforce_e2ee_plaintext_consistency();