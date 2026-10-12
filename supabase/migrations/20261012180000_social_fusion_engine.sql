-- Social Fusion Engine: time-window intent matching, coarse-zone privacy, explicit consent.
DO $$ BEGIN
  CREATE TYPE public.spark_energy AS ENUM ('competitiva','chill','activa','gastronomica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.spark_status AS ENUM ('viva','resonando','cristalizada','expirada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.sparks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  energy_type public.spark_energy NOT NULL DEFAULT 'activa',
  category text NOT NULL DEFAULT 'activity' CHECK (category IN ('tournament','sport','gaming','social','activity','other')),
  time_window_start timestamptz NOT NULL,
  time_window_end timestamptz NOT NULL,
  resources_offered jsonb NOT NULL DEFAULT '{"coche":false,"material":false,"pista":false}'::jsonb,
  geo_zone text NOT NULL DEFAULT 'centro' CHECK (char_length(trim(geo_zone)) BETWEEN 1 AND 80),
  status public.spark_status NOT NULL DEFAULT 'viva',
  fused_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sparks_valid_time_window CHECK (time_window_end > time_window_start AND time_window_end-time_window_start <= interval '24 hours'),
  CONSTRAINT sparks_expiry_future CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS sparks_matching_idx ON public.sparks(category,energy_type,geo_zone,status,time_window_start,time_window_end,expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS sparks_one_live_per_user ON public.sparks(user_id) WHERE status IN ('viva','resonando');
ALTER TABLE public.sparks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sparks_read_active ON public.sparks;
CREATE POLICY sparks_read_active ON public.sparks FOR SELECT TO authenticated
 USING (user_id = (SELECT auth.uid()) OR (status IN ('viva','resonando') AND expires_at > now()));
DROP POLICY IF EXISTS sparks_insert_own ON public.sparks;
CREATE POLICY sparks_insert_own ON public.sparks FOR INSERT TO authenticated
 WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'viva' AND fused_event_id IS NULL AND expires_at <= time_window_end AND expires_at > now());
DROP POLICY IF EXISTS sparks_update_own ON public.sparks;
CREATE POLICY sparks_update_own ON public.sparks FOR UPDATE TO authenticated
 USING (user_id = (SELECT auth.uid()) AND status IN ('viva','resonando'))
 WITH CHECK (user_id = (SELECT auth.uid()) AND status IN ('viva','resonando','expirada'));
DROP POLICY IF EXISTS sparks_delete_own ON public.sparks;
CREATE POLICY sparks_delete_own ON public.sparks FOR DELETE TO authenticated
 USING (user_id = (SELECT auth.uid()) AND status IN ('viva','expirada'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sparks TO authenticated;
REVOKE ALL ON public.sparks FROM anon;

CREATE TABLE IF NOT EXISTS public.fusion_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 spark_ids uuid[] NOT NULL,
 suggested_title text NOT NULL,
 category text NOT NULL CHECK (category IN ('tournament','sport','gaming','social','activity','other')),
 proposed_start timestamptz NOT NULL,
 proposed_end timestamptz NOT NULL,
 proposed_location text NOT NULL,
 geo_zone text NOT NULL,
 quorum_required integer NOT NULL DEFAULT 4 CHECK (quorum_required BETWEEN 2 AND 30),
 accepted_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  declined_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','discarded','expired')),
 fused_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (proposed_end > proposed_start)
);
CREATE INDEX IF NOT EXISTS fusion_proposals_pending_idx ON public.fusion_proposals(status,expires_at);
ALTER TABLE public.fusion_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fusion_proposals_read_participants ON public.fusion_proposals;
CREATE POLICY fusion_proposals_read_participants ON public.fusion_proposals FOR SELECT TO authenticated
 USING (
   EXISTS (SELECT 1 FROM public.sparks s WHERE s.id = ANY(fusion_proposals.spark_ids) AND s.user_id = (SELECT auth.uid()))
   OR (SELECT auth.uid()) = ANY(accepted_user_ids)
 );
GRANT SELECT ON public.fusion_proposals TO authenticated;
REVOKE ALL ON public.fusion_proposals FROM anon;

CREATE OR REPLACE FUNCTION public.evaluate_spark_resonance(new_spark_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
 v_new public.sparks%ROWTYPE;
 v_ids uuid[];
 v_users uuid[];
 v_start timestamptz;
 v_end timestamptz;
 v_proposal uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.'; END IF;
 SELECT * INTO v_new FROM public.sparks WHERE id = new_spark_id AND user_id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Chispa no encontrada o no pertenece a tu cuenta.'; END IF;
 IF v_new.status <> 'viva' OR v_new.expires_at <= now() THEN
   RETURN jsonb_build_object('matched',false,'reason','expired');
 END IF;

 WITH candidates AS (
   SELECT s.id,s.user_id,s.time_window_start,s.time_window_end
   FROM public.sparks s
   WHERE s.status = 'viva' AND s.expires_at > now()
     AND s.category = v_new.category AND s.energy_type = v_new.energy_type
     AND s.geo_zone = v_new.geo_zone
     AND s.time_window_start < v_new.time_window_end
     AND s.time_window_end > v_new.time_window_start
   ORDER BY (s.id = new_spark_id) DESC, s.created_at ASC
   LIMIT 30
 ), dedup AS (
   SELECT DISTINCT ON (user_id) id,user_id,time_window_start,time_window_end
   FROM candidates ORDER BY user_id,(id = new_spark_id) DESC
 )
 SELECT array_agg(id),array_agg(user_id),max(time_window_start),min(time_window_end)
 INTO v_ids,v_users,v_start,v_end FROM dedup;

 IF COALESCE(cardinality(v_users),0) < 4 OR v_end <= v_start OR v_end-v_start < interval '1 hour' THEN
   RETURN jsonb_build_object('matched',false,'active_in_zone',COALESCE(cardinality(v_users),0));
 END IF;

 -- Avoid duplicate live proposals for overlapping sparks.
 SELECT p.id INTO v_proposal FROM public.fusion_proposals p
 WHERE p.status='pending' AND p.expires_at>now() AND p.spark_ids && v_ids
 ORDER BY p.created_at DESC LIMIT 1;
 IF v_proposal IS NOT NULL THEN
   RETURN jsonb_build_object('matched',true,'existing_proposal',true,'proposal_id',v_proposal,'participants_count',cardinality(v_users));
 END IF;

 INSERT INTO public.fusion_proposals(spark_ids,suggested_title,category,proposed_start,proposed_end,proposed_location,geo_zone,quorum_required,accepted_user_ids,expires_at)
 VALUES(v_ids,
   'Plan espontáneo: '||initcap(v_new.category)||' · '||initcap(v_new.energy_type::text),
   v_new.category,v_start,v_end,'Zona '||v_new.geo_zone,v_new.geo_zone,4,ARRAY[auth.uid()],least(v_end,now()+interval '2 hours'))
 RETURNING id INTO v_proposal;

 UPDATE public.sparks SET status='resonando' WHERE id=ANY(v_ids);
 RETURN jsonb_build_object('matched',true,'proposal_id',v_proposal,'participants_count',cardinality(v_users),'accepted_count',1);
END $$;
REVOKE ALL ON FUNCTION public.evaluate_spark_resonance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_spark_resonance(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_fusion_proposal(target_proposal_id uuid, accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
 p public.fusion_proposals%ROWTYPE;
 v_event_id uuid;
 v_date date;
 v_time time;
 v_users uuid[];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.'; END IF;
 SELECT * INTO p FROM public.fusion_proposals WHERE id=target_proposal_id FOR UPDATE;
 IF NOT FOUND OR p.status <> 'pending' OR p.expires_at <= now() THEN
   RAISE EXCEPTION 'La propuesta ya no está disponible.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sparks s WHERE s.id=ANY(p.spark_ids) AND s.user_id=auth.uid() AND s.status='resonando') THEN
   RAISE EXCEPTION 'Solo quienes participan en esta fusión pueden responder.';
 END IF;
 IF NOT accept THEN
   UPDATE public.sparks SET status='viva' WHERE id=ANY(p.spark_ids) AND status='resonando';
   UPDATE public.fusion_proposals SET status='discarded' WHERE id=p.id;
   RETURN jsonb_build_object('accepted',false,'status','discarded');
 END IF;
 IF NOT auth.uid()=ANY(p.accepted_user_ids) THEN
   UPDATE public.fusion_proposals SET accepted_user_ids=array_append(accepted_user_ids,auth.uid()) WHERE id=p.id RETURNING * INTO p;
 END IF;
 IF cardinality(p.accepted_user_ids) < p.quorum_required THEN
   RETURN jsonb_build_object('accepted',true,'confirmed',false,'accepted_count',cardinality(p.accepted_user_ids),'required',p.quorum_required);
 END IF;

 v_date := (p.proposed_start AT TIME ZONE 'Europe/Madrid')::date;
 v_time := (p.proposed_start AT TIME ZONE 'Europe/Madrid')::time;
 INSERT INTO public.events(title, date, time, location, description, created_by, visibility, category, status, format, participant_mode, entry_fee, organizer_name, capacity)
 VALUES(p.suggested_title,v_date,v_time,p.proposed_location,
   'Plan generado por Social Fusion de Curruscos. Confirmad el lugar exacto en el chat antes de acudir.',
   auth.uid(),'public',p.category,'published','standard','individual',0,
   (SELECT COALESCE(display_name,username,'Organizador') FROM public.profiles WHERE id=auth.uid()),cardinality(p.accepted_user_ids))
 RETURNING id INTO v_event_id;

 INSERT INTO public.event_participants(event_id,user_id,status)
 SELECT v_event_id,uid,'yes' FROM unnest(p.accepted_user_ids) uid
 ON CONFLICT(event_id,user_id) DO NOTHING;
 UPDATE public.fusion_proposals SET status='confirmed',fused_event_id=v_event_id WHERE id=p.id;
 UPDATE public.sparks SET status='cristalizada',fused_event_id=v_event_id WHERE id=ANY(p.spark_ids);
 RETURN jsonb_build_object('accepted',true,'confirmed',true,'event_id',v_event_id,'accepted_count',cardinality(p.accepted_user_ids));
END $$;
REVOKE ALL ON FUNCTION public.respond_fusion_proposal(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_fusion_proposal(uuid,boolean) TO authenticated;
COMMENT ON TABLE public.sparks IS 'User-declared social intentions; geo_zone is coarse and never precise location.';
COMMENT ON TABLE public.fusion_proposals IS 'Proposals require explicit participant consent before a public event is created.';
