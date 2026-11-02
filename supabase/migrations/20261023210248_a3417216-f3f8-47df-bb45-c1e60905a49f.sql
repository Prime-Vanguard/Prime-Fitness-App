CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;
ALTER FUNCTION public.is_admin(uuid) SET SCHEMA private;
ALTER FUNCTION public.manages_member(uuid, uuid) SET SCHEMA private;

CREATE OR REPLACE FUNCTION public.guard_profile_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.access_active is distinct from old.access_active and not private.is_admin(auth.uid()) then
    raise exception 'Only admins can change membership access';
  end if;
  if new.email is distinct from old.email and not private.is_admin(auth.uid()) then
    new.email := old.email;
  end if;
  return new;
end; $$;

DROP FUNCTION public.review_pv_claim(uuid, text, text);
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

GRANT UPDATE (status, review_note) ON public.pv_claims TO authenticated;
CREATE POLICY "claims admin review" ON public.pv_claims FOR UPDATE TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_pv_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
    IF OLD.member_id = auth.uid() THEN RAISE EXCEPTION 'cannot review your own claim'; END IF;
  END IF;
  IF OLD.status IN ('approved','rejected') THEN RAISE EXCEPTION 'claim already decided'; END IF;
  IF NEW.status NOT IN ('approved','rejected','needs_info') THEN RAISE EXCEPTION 'invalid status'; END IF;
  NEW.id := OLD.id; NEW.task_id := OLD.task_id; NEW.member_id := OLD.member_id; NEW.note := OLD.note; NEW.created_at := OLD.created_at;
  NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER pv_claims_guard BEFORE UPDATE ON public.pv_claims FOR EACH ROW EXECUTE FUNCTION public.guard_pv_review();

CREATE OR REPLACE FUNCTION public.pv_after_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO public.pv_ledger (member_id, points, source, claim_id, approved_by)
    SELECT NEW.member_id, t.points, 'task_claim', NEW.id, NEW.reviewed_by FROM public.pv_tasks t WHERE t.id = NEW.task_id;
  END IF;
  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, details)
  VALUES (NEW.reviewed_by, 'pv_claim_' || NEW.status, 'pv_claims', NEW.id::text, jsonb_build_object('member', NEW.member_id, 'note', NEW.review_note));
  RETURN NEW;
END $$;
CREATE TRIGGER pv_claims_after_review AFTER UPDATE ON public.pv_claims FOR EACH ROW EXECUTE FUNCTION public.pv_after_review();
REVOKE EXECUTE ON FUNCTION public.guard_pv_review(), public.pv_after_review(), public.guard_profile_update() FROM PUBLIC, anon, authenticated;