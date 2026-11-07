-- Let standalone public events pass the workspace quota trigger without
-- weakening group membership or plan-limit enforcement for group-owned events.

CREATE OR REPLACE FUNCTION public.enforce_group_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_plan record;
  v_count integer;
  v_members integer;
BEGIN
  IF NEW.group_id IS NULL THEN
    -- NEW is a table-specific record; inspect event-only fields only inside
    -- the events branch so the shared trigger remains safe for trips.
    IF TG_TABLE_NAME = 'events' THEN
      IF NEW.visibility = 'public'
         AND NEW.created_by = v_user
         AND v_user IS NOT NULL THEN
        RETURN NEW;
      END IF;
    END IF;
    RAISE EXCEPTION 'GROUP_REQUIRED';
  END IF;

  -- Serialize quota checks per workspace so concurrent inserts cannot exceed limits.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.group_id::text, 0));

  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = NEW.group_id AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'NOT_GROUP_MEMBER';
  END IF;

  SELECT p.code,p.max_members,p.max_events_per_month,p.max_trips
  INTO v_plan
  FROM public.group_subscriptions s
  JOIN public.workspace_plans p ON p.code = s.plan_code
  WHERE s.group_id = NEW.group_id AND s.status IN ('trialing','active')
  LIMIT 1;

  IF v_plan.code IS NULL THEN
    SELECT code,max_members,max_events_per_month,max_trips
    INTO v_plan FROM public.workspace_plans WHERE code = 'free';
  END IF;

  IF TG_TABLE_NAME = 'events' AND v_plan.max_events_per_month IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.events
    WHERE group_id = NEW.group_id AND created_at >= date_trunc('month',now());
    IF v_count >= v_plan.max_events_per_month THEN RAISE EXCEPTION 'PLAN_LIMIT_EVENTS'; END IF;
  END IF;

  IF TG_TABLE_NAME = 'trips' AND v_plan.max_trips IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.trips WHERE group_id = NEW.group_id;
    IF v_count >= v_plan.max_trips THEN RAISE EXCEPTION 'PLAN_LIMIT_TRIPS'; END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Public standalone events have no group recipients. Keep existing group
-- notifications unchanged and avoid trying to emit a group notification for NULL.
CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  creator_name text;
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    SELECT coalesce(display_name, username, 'Alguien')
    INTO creator_name
    FROM public.profiles
    WHERE id = NEW.created_by;

    PERFORM public.create_group_notifications(
      NEW.group_id,
      NEW.created_by,
      'event',
      'Nuevo evento',
      creator_name || ' creó el evento "' || coalesce(NEW.title, 'Evento') || '"',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;
