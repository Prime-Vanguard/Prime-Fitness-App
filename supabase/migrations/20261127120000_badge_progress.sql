-- Phase 5.2: badge progress. Milestone badges count durable activity credits, so members
-- may read their own credits (read-only) through a per-kind count view.
SET LOCAL lock_timeout = '5s';

GRANT SELECT ON private.xp_activity_credits TO authenticated;
CREATE POLICY "own credits read" ON private.xp_activity_credits FOR SELECT TO authenticated
  USING (member_id = (SELECT auth.uid()));

CREATE VIEW public.member_activity_credits WITH (security_invoker = true) AS
  SELECT member_id, kind, count(*)::integer AS credits
  FROM private.xp_activity_credits GROUP BY member_id, kind;
REVOKE ALL ON public.member_activity_credits FROM PUBLIC, anon;
GRANT SELECT ON public.member_activity_credits TO authenticated;
