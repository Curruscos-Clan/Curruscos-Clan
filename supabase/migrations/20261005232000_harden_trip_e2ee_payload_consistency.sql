create or replace function public.enforce_e2ee_payload_consistency()
returns trigger
language plpgsql
as $$
begin
  if new.encrypted_payload is not null then
    if new.encryption_version is null or new.encryption_version < 1 then
      raise exception 'E2EE_VERSION_REQUIRED';
    end if;
  elsif new.encryption_version is not null then
    raise exception 'E2EE_PAYLOAD_REQUIRED';
  end if;

  if tg_table_name = 'trips' and new.encrypted_payload is not null then
    if new.title is not null or new.destination is not null or new.description is not null
       or new.search_preferences is not null or new.recommendations is not null then
      raise exception 'PLAINTEXT_E2EE_FIELDS_FORBIDDEN';
    end if;
  elsif tg_table_name = 'trip_options' and new.encrypted_payload is not null then
    if new.title is not null or new.provider is not null or new.url is not null
       or new.notes is not null or new.metadata is not null then
      raise exception 'PLAINTEXT_E2EE_FIELDS_FORBIDDEN';
    end if;
  elsif tg_table_name = 'trip_itinerary_items' and new.encrypted_payload is not null then
    if new.title is not null or new.location is not null or new.notes is not null or new.url is not null then
      raise exception 'PLAINTEXT_E2EE_FIELDS_FORBIDDEN';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_trips_e2ee_payload_consistency on public.trips;
create trigger enforce_trips_e2ee_payload_consistency before insert or update on public.trips for each row execute function public.enforce_e2ee_payload_consistency();

drop trigger if exists enforce_trip_options_e2ee_payload_consistency on public.trip_options;
create trigger enforce_trip_options_e2ee_payload_consistency before insert or update on public.trip_options for each row execute function public.enforce_e2ee_payload_consistency();

drop trigger if exists enforce_trip_itinerary_e2ee_payload_consistency on public.trip_itinerary_items;
create trigger enforce_trip_itinerary_e2ee_payload_consistency before insert or update on public.trip_itinerary_items for each row execute function public.enforce_e2ee_payload_consistency();