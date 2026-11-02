BEGIN;
-- Manual rollback only; do not place in the forward migration directory.
ALTER POLICY "audit admin read" ON "public"."audit_log" USING (private.is_admin(auth.uid()));
ALTER POLICY "active members only" ON "public"."body_measurements" WITH CHECK (private.is_active(auth.uid()));
ALTER POLICY "body own delete" ON "public"."body_measurements" USING ((member_id = auth.uid()));
ALTER POLICY "body own insert" ON "public"."body_measurements" WITH CHECK ((member_id = auth.uid()));
ALTER POLICY "body own update" ON "public"."body_measurements" USING ((member_id = auth.uid())) WITH CHECK ((member_id = auth.uid()));
ALTER POLICY "body read" ON "public"."body_measurements" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "coach assignments read" ON "public"."coach_assignments" USING ((private.is_admin(auth.uid()) OR (coach_id = auth.uid()) OR (member_id = auth.uid())));
ALTER POLICY "Admins delete exercises" ON "public"."exercises" USING (private.is_admin(auth.uid()));
ALTER POLICY "Admins insert exercises" ON "public"."exercises" WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "Admins update exercises" ON "public"."exercises" USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "Members view active exercises" ON "public"."exercises" USING ((active OR private.is_admin(auth.uid())));
ALTER POLICY "active members only" ON "public"."food_logs" WITH CHECK (private.is_active(auth.uid()));
ALTER POLICY "food own delete" ON "public"."food_logs" USING ((member_id = auth.uid()));
ALTER POLICY "food own insert" ON "public"."food_logs" WITH CHECK ((member_id = auth.uid()));
ALTER POLICY "food own update" ON "public"."food_logs" USING ((member_id = auth.uid())) WITH CHECK ((member_id = auth.uid()));
ALTER POLICY "food read" ON "public"."food_logs" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "foods admin insert" ON "public"."foods" WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "foods admin update" ON "public"."foods" USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "foods read" ON "public"."foods" USING ((active OR private.is_admin(auth.uid())));
ALTER POLICY "invites admin create" ON "public"."invites" WITH CHECK ((private.is_admin(auth.uid()) AND ((role = ANY (ARRAY['member'::app_role, 'coach'::app_role, 'pod_leader'::app_role])) OR private.has_role(auth.uid(), 'super_admin'::app_role))));
ALTER POLICY "invites admin read" ON "public"."invites" USING (private.is_admin(auth.uid()));
ALTER POLICY "invites admin update" ON "public"."invites" USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "leaderboard read" ON "public"."leaderboard_weekly" USING ((opted_in OR (member_id = auth.uid())));
ALTER POLICY "levels admin update" ON "public"."level_thresholds" USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "member badges read" ON "public"."member_badges" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "notifications own mark read" ON "public"."notifications" USING ((member_id = auth.uid())) WITH CHECK ((member_id = auth.uid()));
ALTER POLICY "notifications own read" ON "public"."notifications" USING ((member_id = auth.uid()));
ALTER POLICY "targets read" ON "public"."nutrition_targets" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "pod members read" ON "public"."pod_members" USING ((private.is_admin(( SELECT auth.uid() AS uid)) OR (member_id = ( SELECT auth.uid() AS uid)) OR private.leads_pod(pod_id)));
ALTER POLICY "pods read" ON "public"."pods" USING ((private.is_admin(( SELECT auth.uid() AS uid)) OR private.shares_pod(id, ( SELECT auth.uid() AS uid))));
ALTER POLICY "own profile read" ON "public"."profiles" USING (((id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), id)));
ALTER POLICY "own profile update" ON "public"."profiles" USING (((id = auth.uid()) OR private.is_admin(auth.uid()))) WITH CHECK (((id = auth.uid()) OR private.is_admin(auth.uid())));
ALTER POLICY "assignments read" ON "public"."program_assignments" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "items read" ON "public"."program_items" USING ((private.is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM program_assignments a
  WHERE ((a.program_id = program_items.program_id) AND ((a.member_id = auth.uid()) OR private.manages_member(auth.uid(), a.member_id)))))));
ALTER POLICY "programs read" ON "public"."programs" USING ((private.is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM program_assignments a
  WHERE ((a.program_id = programs.id) AND ((a.member_id = auth.uid()) OR private.manages_member(auth.uid(), a.member_id)))))));
ALTER POLICY "photos active only" ON "public"."progress_photos" WITH CHECK (private.is_active(auth.uid()));
ALTER POLICY "photos own delete" ON "public"."progress_photos" USING ((member_id = auth.uid()));
ALTER POLICY "photos own insert" ON "public"."progress_photos" WITH CHECK (((member_id = auth.uid()) AND (pose = ANY (ARRAY['front'::text, 'side'::text, 'back'::text])) AND (path ~~ ((auth.uid())::text || '/%'::text))));
ALTER POLICY "photos read" ON "public"."progress_photos" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "active members only" ON "public"."pv_claims" WITH CHECK (private.is_active(auth.uid()));
ALTER POLICY "claims admin review" ON "public"."pv_claims" USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "claims own insert" ON "public"."pv_claims" WITH CHECK (((member_id = auth.uid()) AND (status = 'pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (EXISTS ( SELECT 1
   FROM pv_tasks t
  WHERE ((t.id = pv_claims.task_id) AND t.active)))));
ALTER POLICY "claims read" ON "public"."pv_claims" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "ledger read" ON "public"."pv_ledger" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "tasks read" ON "public"."pv_tasks" USING ((active OR private.is_admin(auth.uid())));
ALTER POLICY "redemptions active only" ON "public"."redemptions" WITH CHECK (private.is_active(auth.uid()));
ALTER POLICY "redemptions admin update" ON "public"."redemptions" USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "redemptions own insert" ON "public"."redemptions" WITH CHECK (((member_id = auth.uid()) AND (status = 'pending'::text)));
ALTER POLICY "redemptions read" ON "public"."redemptions" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "rewards admin insert" ON "public"."rewards" WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "rewards admin update" ON "public"."rewards" USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "rewards read" ON "public"."rewards" USING ((active OR private.is_admin(auth.uid())));
ALTER POLICY "favorites own delete" ON "public"."saved_meals" USING ((member_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "favorites own insert" ON "public"."saved_meals" WITH CHECK (((member_id = ( SELECT auth.uid() AS uid)) AND private.is_active(( SELECT auth.uid() AS uid))));
ALTER POLICY "favorites own read" ON "public"."saved_meals" USING ((member_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "favorites own update" ON "public"."saved_meals" USING ((member_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((member_id = ( SELECT auth.uid() AS uid)) AND private.is_active(( SELECT auth.uid() AS uid))));
ALTER POLICY "Delete own sets" ON "public"."set_logs" USING ((member_id = auth.uid()));
ALTER POLICY "Insert own sets in own open session" ON "public"."set_logs" WITH CHECK (((member_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM workout_sessions s
  WHERE ((s.id = set_logs.session_id) AND (s.member_id = auth.uid()) AND (s.finished_at IS NULL))))));
ALTER POLICY "Update own sets" ON "public"."set_logs" USING ((member_id = auth.uid())) WITH CHECK ((member_id = auth.uid()));
ALTER POLICY "View own or managed sets" ON "public"."set_logs" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "active members only" ON "public"."set_logs" WITH CHECK (private.is_active(auth.uid()));
ALTER POLICY "shields own insert" ON "public"."streak_shields" WITH CHECK (((member_id = ( SELECT auth.uid() AS uid)) AND private.is_active(( SELECT auth.uid() AS uid))));
ALTER POLICY "shields own read" ON "public"."streak_shields" USING ((member_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY "admins grant non-admin roles" ON "public"."user_roles" WITH CHECK (((private.is_admin(auth.uid()) AND (role = ANY (ARRAY['member'::app_role, 'coach'::app_role, 'pod_leader'::app_role]))) OR private.has_role(auth.uid(), 'super_admin'::app_role)));
ALTER POLICY "admins revoke non-admin roles" ON "public"."user_roles" USING (((private.is_admin(auth.uid()) AND (role = ANY (ARRAY['member'::app_role, 'coach'::app_role, 'pod_leader'::app_role]))) OR (private.has_role(auth.uid(), 'super_admin'::app_role) AND (user_id <> auth.uid()))));
ALTER POLICY "read own roles" ON "public"."user_roles" USING (((user_id = auth.uid()) OR private.is_admin(auth.uid())));
ALTER POLICY "active members only" ON "public"."water_logs" WITH CHECK (private.is_active(auth.uid()));
ALTER POLICY "water own delete" ON "public"."water_logs" USING ((member_id = auth.uid()));
ALTER POLICY "water own insert" ON "public"."water_logs" WITH CHECK ((member_id = auth.uid()));
ALTER POLICY "water read" ON "public"."water_logs" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "Delete own unfinished sessions" ON "public"."workout_sessions" USING (((member_id = auth.uid()) AND (finished_at IS NULL)));
ALTER POLICY "Insert own sessions" ON "public"."workout_sessions" WITH CHECK ((member_id = auth.uid()));
ALTER POLICY "Update own sessions" ON "public"."workout_sessions" USING ((member_id = auth.uid())) WITH CHECK ((member_id = auth.uid()));
ALTER POLICY "View own or managed sessions" ON "public"."workout_sessions" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "active members only" ON "public"."workout_sessions" WITH CHECK (private.is_active(auth.uid()));
ALTER POLICY "xp read" ON "public"."xp_events" USING (((member_id = auth.uid()) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id)));
ALTER POLICY "progress photos own delete" ON "storage"."objects" USING (((bucket_id = 'progress-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
ALTER POLICY "progress photos own upload" ON "storage"."objects" WITH CHECK (((bucket_id = 'progress-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND private.is_active(auth.uid())));
ALTER POLICY "progress photos read" ON "storage"."objects" USING (((bucket_id = 'progress-photos'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), ((storage.foldername(name))[1])::uuid))));
DROP POLICY "coach assignments admin write (insert)" ON "public"."coach_assignments";
DROP POLICY "coach assignments admin write (update)" ON "public"."coach_assignments";
DROP POLICY "coach assignments admin write (delete)" ON "public"."coach_assignments";
CREATE POLICY "coach assignments admin write" ON "public"."coach_assignments" AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
DROP POLICY "targets write (insert)" ON "public"."nutrition_targets";
DROP POLICY "targets write (update)" ON "public"."nutrition_targets";
DROP POLICY "targets write (delete)" ON "public"."nutrition_targets";
CREATE POLICY "targets write" ON "public"."nutrition_targets" AS PERMISSIVE FOR ALL TO authenticated USING ((private.is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM coach_assignments c
  WHERE ((c.coach_id = auth.uid()) AND (c.member_id = nutrition_targets.member_id) AND c.active))))) WITH CHECK ((private.is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM coach_assignments c
  WHERE ((c.coach_id = auth.uid()) AND (c.member_id = nutrition_targets.member_id) AND c.active)))));
DROP POLICY "pod members admin write (insert)" ON "public"."pod_members";
DROP POLICY "pod members admin write (update)" ON "public"."pod_members";
DROP POLICY "pod members admin write (delete)" ON "public"."pod_members";
CREATE POLICY "pod members admin write" ON "public"."pod_members" AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
DROP POLICY "pods admin write (insert)" ON "public"."pods";
DROP POLICY "pods admin write (update)" ON "public"."pods";
DROP POLICY "pods admin write (delete)" ON "public"."pods";
CREATE POLICY "pods admin write" ON "public"."pods" AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
DROP POLICY "assignments admin write (insert)" ON "public"."program_assignments";
DROP POLICY "assignments admin write (update)" ON "public"."program_assignments";
DROP POLICY "assignments admin write (delete)" ON "public"."program_assignments";
CREATE POLICY "assignments admin write" ON "public"."program_assignments" AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
DROP POLICY "items admin write (insert)" ON "public"."program_items";
DROP POLICY "items admin write (update)" ON "public"."program_items";
DROP POLICY "items admin write (delete)" ON "public"."program_items";
CREATE POLICY "items admin write" ON "public"."program_items" AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
DROP POLICY "programs admin write (insert)" ON "public"."programs";
DROP POLICY "programs admin write (update)" ON "public"."programs";
DROP POLICY "programs admin write (delete)" ON "public"."programs";
CREATE POLICY "programs admin write" ON "public"."programs" AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
DROP POLICY "tasks admin write (insert)" ON "public"."pv_tasks";
DROP POLICY "tasks admin write (update)" ON "public"."pv_tasks";
DROP POLICY "tasks admin write (delete)" ON "public"."pv_tasks";
CREATE POLICY "tasks admin write" ON "public"."pv_tasks" AS PERMISSIVE FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
DROP INDEX "public"."coach_assignments_member_id_idx";
DROP INDEX "public"."exercises_created_by_idx";
DROP INDEX "public"."invites_coach_id_idx";
DROP INDEX "public"."invites_invited_by_idx";
DROP INDEX "public"."invites_pod_id_idx";
DROP INDEX "public"."member_badges_badge_code_idx";
DROP INDEX "public"."pods_leader_id_idx";
DROP INDEX "public"."program_assignments_program_id_idx";
DROP INDEX "public"."program_items_exercise_id_idx";
DROP INDEX "public"."pv_claims_member_id_idx";
DROP INDEX "public"."pv_claims_task_id_idx";
DROP INDEX "public"."pv_ledger_member_id_idx";
DROP INDEX "public"."pv_ledger_redemption_id_idx";
DROP INDEX "public"."redemptions_reward_id_idx";
DROP INDEX "public"."set_logs_exercise_id_idx";

COMMIT;
