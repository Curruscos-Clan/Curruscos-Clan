-- E2EE payload fields. Client-side encryption is required before writing these fields.
alter table public.chat_messages add column if not exists encrypted_body text;
alter table public.memories add column if not exists encrypted_payload text;
alter table public.tasks add column if not exists encrypted_payload text;
alter table public.trips add column if not exists encrypted_payload text;
alter table public.trip_options add column if not exists encrypted_payload text;
alter table public.trip_itinerary_items add column if not exists encrypted_payload text;
alter table public.expenses add column if not exists encrypted_payload text;
alter table public.expense_splits add column if not exists encrypted_payload text;

alter table public.chat_messages add column if not exists encryption_version integer;
alter table public.memories add column if not exists encryption_version integer;
alter table public.tasks add column if not exists encryption_version integer;
alter table public.trips add column if not exists encryption_version integer;
alter table public.trip_options add column if not exists encryption_version integer;
alter table public.trip_itinerary_items add column if not exists encryption_version integer;
alter table public.expenses add column if not exists encryption_version integer;
alter table public.expense_splits add column if not exists encryption_version integer;
