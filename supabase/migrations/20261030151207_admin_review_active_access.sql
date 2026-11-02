-- Keep existing role/ownership policies and reward triggers authoritative.
-- A role alone must not allow paused administrators to mutate these workflows.
-- Scalar permission checks are independent of the row and evaluated once per statement.
CREATE POLICY "active invitation inserts" ON public.invites AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

CREATE POLICY "active invitation updates" ON public.invites AS RESTRICTIVE
FOR UPDATE TO authenticated
USING ((SELECT private.is_active((SELECT auth.uid()))))
WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

CREATE POLICY "active PV task inserts" ON public.pv_tasks AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

CREATE POLICY "active PV task updates" ON public.pv_tasks AS RESTRICTIVE
FOR UPDATE TO authenticated
USING ((SELECT private.is_active((SELECT auth.uid()))))
WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

CREATE POLICY "active PV task deletes" ON public.pv_tasks AS RESTRICTIVE
FOR DELETE TO authenticated USING ((SELECT private.is_active((SELECT auth.uid()))));

CREATE POLICY "active PV claim reviews" ON public.pv_claims AS RESTRICTIVE
FOR UPDATE TO authenticated
USING ((SELECT private.is_active((SELECT auth.uid()))))
WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));
