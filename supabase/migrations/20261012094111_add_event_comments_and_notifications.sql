-- Comentarios de eventos y avisos del organizador.
-- Reutiliza public.notifications (is_read/reference_id) y los buckets existentes.
-- No crea buckets duplicados ni expone el contenido de eventos privados.

CREATE TABLE IF NOT EXISTS public.event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  author_display_name text NOT NULL DEFAULT 'Miembro de Curruscos',
  author_avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_comments_content_length_check
    CHECK (char_length(btrim(content)) BETWEEN 1 AND 500)
);

ALTER TABLE public.event_comments
  ADD COLUMN IF NOT EXISTS author_display_name text NOT NULL DEFAULT 'Miembro de Curruscos';
ALTER TABLE public.event_comments
  ADD COLUMN IF NOT EXISTS author_avatar_url text;

CREATE INDEX IF NOT EXISTS event_comments_event_created_idx
  ON public.event_comments (event_id, created_at ASC);

ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read comments for accessible events" ON public.event_comments;
CREATE POLICY "Read comments for accessible events"
  ON public.event_comments
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_comments.event_id
        AND e.status IN ('published', 'preparing', 'live', 'finished')
        AND (
          e.visibility = 'public'
          OR (
            e.group_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.group_members gm
              WHERE gm.group_id = e.group_id
                AND gm.user_id = (SELECT auth.uid())
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated members can comment on accessible events" ON public.event_comments;
CREATE POLICY "Authenticated members can comment on accessible events"
  ON public.event_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_comments.event_id
        AND e.status IN ('published', 'preparing', 'live')
        AND (
          e.visibility = 'public'
          OR (
            e.group_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.group_members gm
              WHERE gm.group_id = e.group_id
                AND gm.user_id = (SELECT auth.uid())
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Authors and event managers can delete comments" ON public.event_comments;
CREATE POLICY "Authors and event managers can delete comments"
  ON public.event_comments
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_comments.event_id
        AND (
          e.created_by = (SELECT auth.uid())
          OR (
            e.group_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.group_members gm
              WHERE gm.group_id = e.group_id
                AND gm.user_id = (SELECT auth.uid())
                AND gm.role IN ('owner', 'admin')
            )
          )
        )
    )
  );

GRANT SELECT ON TABLE public.event_comments TO anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.event_comments TO authenticated;

-- Populate public-facing author information server-side and enforce a per-user
-- rate limit. A transaction-scoped advisory lock prevents parallel requests
-- from all passing the count check at once.
CREATE OR REPLACE FUNCTION public.prepare_event_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  recent_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(NEW.user_id::text)::bigint
  );

  SELECT count(*)::integer
    INTO recent_count
  FROM public.event_comments c
  WHERE c.user_id = NEW.user_id
    AND c.created_at >= pg_catalog.now() - interval '1 minute';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Has publicado demasiados comentarios. Espera un minuto e inténtalo de nuevo.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'Miembro de Curruscos'),
    p.avatar_url
  INTO NEW.author_display_name, NEW.author_avatar_url
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF NEW.author_display_name IS NULL THEN
    NEW.author_display_name := 'Miembro de Curruscos';
    NEW.author_avatar_url := NULL;
  END IF;

  -- The caller cannot backdate an insert to bypass the server-side rate limit.
  NEW.created_at := pg_catalog.now();
  NEW.content := btrim(NEW.content);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prepare_event_comment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS prepare_event_comment_before_insert ON public.event_comments;
CREATE TRIGGER prepare_event_comment_before_insert
  BEFORE INSERT ON public.event_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_event_comment();

-- Use the existing notifications schema: user_id/group_id/type/title/message/
-- reference_id/is_read. No parallel notification model is created.
CREATE OR REPLACE FUNCTION public.notify_event_comment_organizer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  event_creator_id uuid;
  event_group_id uuid;
  event_title text;
  actor_name text;
BEGIN
  SELECT e.created_by, e.group_id, e.title
    INTO event_creator_id, event_group_id, event_title
  FROM public.events e
  WHERE e.id = NEW.event_id;

  IF event_creator_id IS NULL OR event_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'Un usuario')
    INTO actor_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  INSERT INTO public.notifications (
    user_id, group_id, type, title, message, reference_id
  )
  VALUES (
    event_creator_id,
    event_group_id,
    'new_comment',
    'Nuevo comentario en tu plan',
    coalesce(actor_name, 'Un usuario') || ' ha comentado en "' ||
      coalesce(event_title, 'tu plan') || '".',
    NEW.event_id
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_event_comment_organizer() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_event_comment_organizer_after_insert ON public.event_comments;
CREATE TRIGGER notify_event_comment_organizer_after_insert
  AFTER INSERT ON public.event_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_event_comment_organizer();

-- Public events created outside a group do not reach the existing group-wide
-- participant notification function. Add a targeted organizer alert for them;
-- group events continue using the existing group notification system.
CREATE OR REPLACE FUNCTION public.notify_public_event_organizer_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  event_creator_id uuid;
  event_title text;
  actor_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'yes' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT e.created_by, e.title
    INTO event_creator_id, event_title
  FROM public.events e
  WHERE e.id = NEW.event_id
    AND e.visibility = 'public'
    AND e.group_id IS NULL
    AND e.status = 'published';

  IF NOT FOUND OR event_creator_id IS NULL OR event_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'Un usuario')
    INTO actor_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  INSERT INTO public.notifications (
    user_id, group_id, type, title, message, reference_id
  )
  VALUES (
    event_creator_id,
    NULL,
    'participant_joined',
    'Nueva inscripción en tu plan',
    coalesce(actor_name, 'Un usuario') || ' se ha apuntado a "' ||
      coalesce(event_title, 'tu plan') || '".',
    NEW.event_id
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_public_event_organizer_joined() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_public_event_organizer_after_join ON public.event_participants;
CREATE TRIGGER notify_public_event_organizer_after_join
  AFTER INSERT OR UPDATE OF status ON public.event_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_public_event_organizer_joined();

-- Subscribe event_comments to the existing publication without resetting the
-- publication or interrupting notification/chat subscriptions.
DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'event_comments'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments';
  END IF;
END;
$publication$;

COMMENT ON TABLE public.event_comments IS
  'Comments on public events and events visible to the author''s group. Author display details are snapshotted server-side.';
