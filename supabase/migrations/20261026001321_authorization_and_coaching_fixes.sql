SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Invitations are immutable allowlist entries. Revoke and recreate to change identity/role.
-- The Auth signup trigger alone consumes accepted_at through a nested, trusted invocation.
CREATE FUNCTION private.guard_invitation_update() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user NOT IN ('anon','authenticated') AND pg_trigger_depth() > 1
    AND OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL
    AND (to_jsonb(NEW)-'accepted_at') = (to_jsonb(OLD)-'accepted_at') THEN
    RETURN NEW;
  END IF;
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF OLD.role IN ('admin','super_admin') AND NOT private.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can revoke privileged invitations';
  END IF;
  IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') THEN
    RAISE EXCEPTION 'Invitation identity and role are immutable; revoke and recreate';
  END IF;
  IF OLD.accepted_at IS NOT NULL OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'Only pending invitations can be revoked';
  END IF;
  NEW.revoked_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_invitation_update() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_invitation_update BEFORE UPDATE ON public.invites
FOR EACH ROW EXECUTE FUNCTION private.guard_invitation_update();

CREATE OR REPLACE FUNCTION public.guard_profile_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.access_active IS DISTINCT FROM OLD.access_active THEN
    IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can change membership access'; END IF;
    IF private.has_role(OLD.id,'super_admin') THEN
      IF NOT private.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Only super admins can manage owner access'; END IF;
      IF NOT NEW.access_active THEN RAISE EXCEPTION 'Super admin accounts cannot be paused'; END IF;
    END IF;
    IF OLD.id = auth.uid() AND NOT NEW.access_active THEN RAISE EXCEPTION 'You cannot pause your own account'; END IF;
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email AND NOT private.is_admin(auth.uid()) THEN NEW.email := OLD.email; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_profile_update() FROM PUBLIC,anon,authenticated;

-- A set and its parent session must belong to the same member, including privileged writes.
ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_sessions_id_member_key UNIQUE (id,member_id);
CREATE INDEX set_logs_session_member_idx ON public.set_logs(session_id,member_id);
ALTER TABLE public.set_logs ADD CONSTRAINT set_logs_session_member_fkey
  FOREIGN KEY (session_id,member_id) REFERENCES public.workout_sessions(id,member_id) ON DELETE CASCADE;
-- Replace the old relation so PostgREST's workout -> set_logs embedding stays unambiguous.
ALTER TABLE public.set_logs DROP CONSTRAINT set_logs_session_id_fkey;
ALTER POLICY "Update own sets" ON public.set_logs WITH CHECK (
  member_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.workout_sessions s WHERE s.id=set_logs.session_id AND s.member_id=(SELECT auth.uid())
  )
);

DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['workout_sessions','set_logs','food_logs','body_measurements'] LOOP
    EXECUTE format('CREATE POLICY "active members update only" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING ((SELECT private.is_active((SELECT auth.uid())))) WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))))',tab);
  END LOOP;
END $$;

-- Defense in depth for existing malformed records as well as future writes.
CREATE OR REPLACE FUNCTION public.xp_on_workout() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c integer;
BEGIN
  IF OLD.finished_at IS NULL AND NEW.finished_at IS NOT NULL
    AND NEW.finished_at >= NEW.started_at AND NEW.finished_at <= now()
    AND EXISTS (SELECT 1 FROM public.set_logs WHERE session_id=NEW.id AND member_id=NEW.member_id AND reps>0)
    AND private.claim_activity_xp(NEW.member_id,'workout',(NEW.started_at AT TIME ZONE 'Africa/Cairo')::date,NEW.id::text) THEN
    PERFORM public.award_xp(NEW.member_id,(SELECT workout_xp FROM public.xp_rules),'workout',NEW.id::text);
    SELECT count(*) INTO c FROM private.xp_activity_credits WHERE member_id=NEW.member_id AND kind='workout';
    IF c>=1 THEN PERFORM public.grant_badge(NEW.member_id,'first_workout'); END IF;
    IF c>=10 THEN PERFORM public.grant_badge(NEW.member_id,'workouts_10'); END IF;
    IF c>=50 THEN PERFORM public.grant_badge(NEW.member_id,'workouts_50'); END IF;
    IF c>=100 THEN PERFORM public.grant_badge(NEW.member_id,'workouts_100'); END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.xp_on_workout() FROM PUBLIC,anon,authenticated;

-- RLS remains in force; the profile lock serializes concurrent reassignments.
CREATE FUNCTION public.set_member_coach(_member uuid,_coach uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin(auth.uid()) OR NOT private.is_active(auth.uid()) THEN
    RAISE EXCEPTION 'Only active admins can assign coaches';
  END IF;
  PERFORM 1 FROM public.profiles WHERE id=_member FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF _coach IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=_coach AND p.access_active AND private.has_role(p.id,'coach')
  ) THEN RAISE EXCEPTION 'Select an active coach'; END IF;
  UPDATE public.coach_assignments SET active=false WHERE member_id=_member AND active AND coach_id IS DISTINCT FROM _coach;
  IF _coach IS NOT NULL THEN
    INSERT INTO public.coach_assignments(coach_id,member_id) VALUES (_coach,_member)
      ON CONFLICT (coach_id,member_id) DO UPDATE SET active=true;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_member_coach(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_member_coach(uuid,uuid) TO authenticated;
