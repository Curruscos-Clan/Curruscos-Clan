alter table public.chat_messages alter column body drop not null;
alter table public.tasks alter column title drop not null;
alter table public.chat_messages drop constraint if exists chat_messages_body_check;
alter table public.chat_messages drop constraint if exists chat_messages_content_check;
alter table public.chat_messages add constraint chat_messages_content_check check ((encrypted_body is not null and encryption_version is not null and encryption_version > 0 and body is null) or (encrypted_body is null and encryption_version is null and body is not null and char_length(btrim(body)) between 1 and 2000));
alter table public.tasks drop constraint if exists tasks_title_nonempty;
alter table public.tasks drop constraint if exists tasks_content_check;
alter table public.tasks add constraint tasks_content_check check ((encrypted_payload is not null and encryption_version is not null and encryption_version > 0 and title is null) or (encrypted_payload is null and encryption_version is null and title is not null and length(trim(title)) > 0));