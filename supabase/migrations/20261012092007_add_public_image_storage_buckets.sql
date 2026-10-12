-- Public image storage for Curruscos profile pictures and public event covers.
-- Uploads are restricted to a folder named with the authenticated user's UUID.
-- Public buckets are deliberate: avatar and public-event cover images are public assets.
-- Private groups and encrypted group events must not use these buckets for private content.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_url text;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname = 'events_cover_url_https_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_cover_url_https_check
      CHECK (
        cover_url IS NULL OR (
          char_length(btrim(cover_url)) BETWEEN 1 AND 2048
          AND cover_url ~ '^https://[^[:space:]]+$'
        )
      );
  END IF;
END
$migration$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 8388608, ARRAY['image/webp', 'image/jpeg']::text[]),
  ('event-covers', 'event-covers', true, 8388608, ARRAY['image/webp', 'image/jpeg']::text[])
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Curruscos upload own avatars'
  ) THEN
    CREATE POLICY "Curruscos upload own avatars"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Curruscos upload own event covers'
  ) THEN
    CREATE POLICY "Curruscos upload own event covers"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'event-covers'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Curruscos delete own avatars'
  ) THEN
    CREATE POLICY "Curruscos delete own avatars"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Curruscos delete own event covers'
  ) THEN
    CREATE POLICY "Curruscos delete own event covers"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'event-covers'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;
END
$migration$;

COMMENT ON COLUMN public.events.cover_url IS
  'Optional URL of a public event cover stored in Supabase Storage. Do not use for private group content.';
