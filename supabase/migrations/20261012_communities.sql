-- Curruscos Clan: directorio seguro de grupos existentes.
-- Reutiliza public.groups y public.group_members; no crea una segunda entidad
-- paralela llamada communities.

CREATE TABLE IF NOT EXISTS public.group_membership_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS group_membership_requests_one_pending
  ON public.group_membership_requests (group_id, user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS group_membership_requests_group_status_idx
  ON public.group_membership_requests (group_id, status, created_at DESC);

ALTER TABLE public.group_membership_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and group admins can view membership requests"
  ON public.group_membership_requests;
CREATE POLICY "Users and group admins can view membership requests"
  ON public.group_membership_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_group_admin(group_id));

-- No se concede INSERT/UPDATE/DELETE directo: las operaciones pasan por RPC
-- que valida identidad, visibilidad y rol en una única transacción.

DROP POLICY IF EXISTS "Anyone can discover public workspaces" ON public.groups;
CREATE POLICY "Anyone can discover public workspaces"
  ON public.groups
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public');

CREATE OR REPLACE FUNCTION public.discover_groups(
  search_text text DEFAULT NULL,
  visibility_filter text DEFAULT 'all',
  type_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  slug text,
  visibility text,
  workspace_type text,
  avatar_url text,
  created_at timestamptz,
  member_count bigint,
  is_member boolean,
  is_admin boolean,
  request_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT
    g.id,
    g.name,
    g.description,
    g.slug,
    g.visibility,
    g.workspace_type,
    g.avatar_url,
    g.created_at,
    CASE
      WHEN g.visibility = 'public'
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
        )
      THEN (SELECT count(*) FROM public.group_members gm WHERE gm.group_id = g.id)
      ELSE NULL
    END AS member_count,
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
    ) AS is_member,
    public.is_group_admin(g.id) AS is_admin,
    (
      SELECT r.status
      FROM public.group_membership_requests r
      WHERE r.group_id = g.id AND r.user_id = auth.uid()
      ORDER BY r.created_at DESC
      LIMIT 1
    ) AS request_status
  FROM public.groups g
  WHERE
    (
      g.visibility = 'public'
      OR (
        auth.uid() IS NOT NULL
        AND visibility_filter IN ('all', 'private')
        AND g.visibility = 'private'
      )
      OR EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
      )
    )
    AND (
      visibility_filter = 'all'
      OR (visibility_filter = 'public' AND g.visibility = 'public')
      OR (visibility_filter = 'private' AND g.visibility = 'private' AND auth.uid() IS NOT NULL)
    )
    AND (
      type_filter IS NULL OR type_filter = '' OR type_filter = 'all'
      OR g.workspace_type = type_filter
    )
    AND (
      search_text IS NULL OR btrim(search_text) = ''
      OR g.name ILIKE '%' || left(btrim(search_text), 80) || '%'
      OR coalesce(g.description, '') ILIKE '%' || left(btrim(search_text), 80) || '%'
    )
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
    ) THEN 0 ELSE 1 END,
    g.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.request_group_membership(target_group_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  target_visibility text;
  existing_status text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para unirte a un grupo.'
      USING ERRCODE = '42501';
  END IF;

  SELECT g.visibility INTO target_visibility
  FROM public.groups g
  WHERE g.id = target_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El grupo no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = target_group_id AND gm.user_id = current_user_id
  ) THEN
    RETURN 'already_member';
  END IF;

  IF target_visibility = 'public' THEN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (target_group_id, current_user_id, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
    RETURN 'joined';
  END IF;

  IF target_visibility NOT IN ('private', 'unlisted') THEN
    RAISE EXCEPTION 'No se puede solicitar acceso a este grupo.'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.status INTO existing_status
  FROM public.group_membership_requests r
  WHERE r.group_id = target_group_id AND r.user_id = current_user_id
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF existing_status = 'pending' THEN
    RETURN 'already_pending';
  END IF;

  INSERT INTO public.group_membership_requests (group_id, user_id, status)
  VALUES (target_group_id, current_user_id, 'pending')
  ON CONFLICT (group_id, user_id) WHERE status = 'pending' DO NOTHING;

  RETURN 'requested';
END;
$$;

CREATE OR REPLACE FUNCTION public.review_group_membership_request(
  target_request_id uuid,
  approve_request boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  pending_request public.group_membership_requests%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.' USING ERRCODE = '42501';
  END IF;

  SELECT r.* INTO pending_request
  FROM public.group_membership_requests r
  WHERE r.id = target_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_group_admin(pending_request.group_id) THEN
    RAISE EXCEPTION 'Solo un administrador puede resolver solicitudes.'
      USING ERRCODE = '42501';
  END IF;

  IF pending_request.status <> 'pending' THEN
    RETURN pending_request.status;
  END IF;

  IF approve_request THEN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (pending_request.group_id, pending_request.user_id, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  UPDATE public.group_membership_requests
  SET status = CASE WHEN approve_request THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now(),
      reviewed_by = current_user_id
  WHERE id = target_request_id;

  RETURN CASE WHEN approve_request THEN 'approved' ELSE 'rejected' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_discoverable_group(
  group_name text,
  group_description text DEFAULT NULL,
  group_visibility text DEFAULT 'public',
  group_type text DEFAULT 'community'
)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private, pg_temp
AS $$
DECLARE
  created_group public.groups;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para crear un grupo.'
      USING ERRCODE = '42501';
  END IF;

  IF group_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'La visibilidad debe ser pública o privada.';
  END IF;

  IF length(btrim(coalesce(group_name, ''))) < 3
     OR length(btrim(group_name)) > 80 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 3 y 80 caracteres.';
  END IF;

  IF group_type NOT IN ('community', 'sports', 'travel', 'study', 'organization', 'other') THEN
    RAISE EXCEPTION 'La categoría del grupo no es válida.';
  END IF;

  SELECT private.create_group_secure(
    btrim(group_name),
    nullif(btrim(coalesce(group_description, '')), ''),
    group_type,
    'small',
    NULL
  ) INTO created_group;

  UPDATE public.groups
  SET visibility = group_visibility
  WHERE id = created_group.id AND created_by = auth.uid()
  RETURNING * INTO created_group;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se ha podido configurar la visibilidad del grupo.';
  END IF;

  RETURN created_group;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_discoverable_group_events(target_group_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  date date,
  time time,
  location text,
  description text,
  category text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT e.id, e.title, e.date, e.time, e.location, e.description, e.category
  FROM public.events e
  JOIN public.groups g ON g.id = e.group_id
  WHERE e.group_id = target_group_id
    AND e.visibility = 'public'
    AND e.status IN ('published', 'finished')
    AND (
      g.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
      )
    )
  ORDER BY e.date DESC, e.time DESC NULLS LAST
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.discover_groups(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_group_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_group_membership_request(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_discoverable_group(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_discoverable_group_events(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.discover_groups(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_group_membership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_group_membership_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_discoverable_group(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discoverable_group_events(uuid) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.get_group_membership_requests(target_group_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  display_name text,
  username text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_admin(target_group_id) THEN
    RAISE EXCEPTION 'Solo los administradores del grupo pueden ver estas solicitudes.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.id, r.user_id, p.display_name, p.username, r.created_at
  FROM public.group_membership_requests r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.group_id = target_group_id AND r.status = 'pending'
  ORDER BY r.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_membership_requests(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_membership_requests(uuid) TO authenticated;
