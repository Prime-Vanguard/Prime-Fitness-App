-- Keep existing roles, terminal-review guards and server refunds authoritative.
CREATE POLICY "active reward creation" ON public.rewards AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));
CREATE POLICY "active reward editing" ON public.rewards AS RESTRICTIVE
FOR UPDATE TO authenticated
USING ((SELECT private.is_active((SELECT auth.uid()))))
WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));
CREATE POLICY "active redemption reviews" ON public.redemptions AS RESTRICTIVE
FOR UPDATE TO authenticated
USING ((SELECT private.is_active((SELECT auth.uid()))))
WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));
