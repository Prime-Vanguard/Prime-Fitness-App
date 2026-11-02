-- Preserve the existing access model while caching row-independent identity checks.
-- Restrictive membership policies remain restrictive; row-dependent lookups remain correlated.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER POLICY "audit admin read" ON "public"."audit_log"
  USING ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "active members only" ON "public"."body_measurements"
  WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

ALTER POLICY "body own delete" ON "public"."body_measurements"
  USING ((member_id = (SELECT auth.uid())));

ALTER POLICY "body own insert" ON "public"."body_measurements"
  WITH CHECK ((member_id = (SELECT auth.uid())));

ALTER POLICY "body own update" ON "public"."body_measurements"
  USING ((member_id = (SELECT auth.uid())))
  WITH CHECK ((member_id = (SELECT auth.uid())));

ALTER POLICY "body read" ON "public"."body_measurements"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "coach assignments read" ON "public"."coach_assignments"
  USING ((((SELECT private.is_admin((SELECT auth.uid()))) OR (coach_id = (SELECT auth.uid())) OR (member_id = (SELECT auth.uid())))) OR ((SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "Admins delete exercises" ON "public"."exercises"
  USING ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "Admins insert exercises" ON "public"."exercises"
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "Admins update exercises" ON "public"."exercises"
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "Members view active exercises" ON "public"."exercises"
  USING ((active OR (SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "active members only" ON "public"."food_logs"
  WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

ALTER POLICY "food own delete" ON "public"."food_logs"
  USING ((member_id = (SELECT auth.uid())));

ALTER POLICY "food own insert" ON "public"."food_logs"
  WITH CHECK ((member_id = (SELECT auth.uid())));

ALTER POLICY "food own update" ON "public"."food_logs"
  USING ((member_id = (SELECT auth.uid())))
  WITH CHECK ((member_id = (SELECT auth.uid())));

ALTER POLICY "food read" ON "public"."food_logs"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "foods admin insert" ON "public"."foods"
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "foods admin update" ON "public"."foods"
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "foods read" ON "public"."foods"
  USING ((active OR (SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "invites admin create" ON "public"."invites"
  WITH CHECK (((SELECT private.is_admin((SELECT auth.uid()))) AND ((role = ANY (ARRAY['member'::app_role, 'coach'::app_role, 'pod_leader'::app_role])) OR (SELECT private.has_role((SELECT auth.uid()), 'super_admin'::app_role)))));

ALTER POLICY "invites admin read" ON "public"."invites"
  USING ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "invites admin update" ON "public"."invites"
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "leaderboard read" ON "public"."leaderboard_weekly"
  USING ((opted_in OR (member_id = (SELECT auth.uid()))));

ALTER POLICY "levels admin update" ON "public"."level_thresholds"
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "member badges read" ON "public"."member_badges"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "notifications own mark read" ON "public"."notifications"
  USING ((member_id = (SELECT auth.uid())))
  WITH CHECK ((member_id = (SELECT auth.uid())));

ALTER POLICY "notifications own read" ON "public"."notifications"
  USING ((member_id = (SELECT auth.uid())));

ALTER POLICY "targets read" ON "public"."nutrition_targets"
  USING ((((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id))) OR (((SELECT private.is_admin((SELECT auth.uid()))) OR (EXISTS ( SELECT 1
   FROM coach_assignments c
  WHERE ((c.coach_id = (SELECT auth.uid())) AND (c.member_id = nutrition_targets.member_id) AND c.active))))));

ALTER POLICY "pod members read" ON "public"."pod_members"
  USING ((((SELECT private.is_admin((SELECT auth.uid()))) OR (member_id = (SELECT auth.uid())) OR private.leads_pod(pod_id))) OR ((SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "pods read" ON "public"."pods"
  USING ((((SELECT private.is_admin((SELECT auth.uid()))) OR private.shares_pod(id, (SELECT auth.uid())))) OR ((SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "own profile read" ON "public"."profiles"
  USING (((id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), id)));

ALTER POLICY "own profile update" ON "public"."profiles"
  USING (((id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid())))))
  WITH CHECK (((id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "assignments read" ON "public"."program_assignments"
  USING ((((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id))) OR ((SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "items read" ON "public"."program_items"
  USING ((((SELECT private.is_admin((SELECT auth.uid()))) OR (EXISTS ( SELECT 1
   FROM program_assignments a
  WHERE ((a.program_id = program_items.program_id) AND ((a.member_id = (SELECT auth.uid())) OR private.manages_member((SELECT auth.uid()), a.member_id))))))) OR ((SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "programs read" ON "public"."programs"
  USING ((((SELECT private.is_admin((SELECT auth.uid()))) OR (EXISTS ( SELECT 1
   FROM program_assignments a
  WHERE ((a.program_id = programs.id) AND ((a.member_id = (SELECT auth.uid())) OR private.manages_member((SELECT auth.uid()), a.member_id))))))) OR ((SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "photos active only" ON "public"."progress_photos"
  WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

ALTER POLICY "photos own delete" ON "public"."progress_photos"
  USING ((member_id = (SELECT auth.uid())));

ALTER POLICY "photos own insert" ON "public"."progress_photos"
  WITH CHECK (((member_id = (SELECT auth.uid())) AND (pose = ANY (ARRAY['front'::text, 'side'::text, 'back'::text])) AND (path ~~ (((SELECT auth.uid()))::text || '/%'::text))));

ALTER POLICY "photos read" ON "public"."progress_photos"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "active members only" ON "public"."pv_claims"
  WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

ALTER POLICY "claims admin review" ON "public"."pv_claims"
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "claims own insert" ON "public"."pv_claims"
  WITH CHECK (((member_id = (SELECT auth.uid())) AND (status = 'pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (EXISTS ( SELECT 1
   FROM pv_tasks t
  WHERE ((t.id = pv_claims.task_id) AND t.active)))));

ALTER POLICY "claims read" ON "public"."pv_claims"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "ledger read" ON "public"."pv_ledger"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "tasks read" ON "public"."pv_tasks"
  USING (((active OR (SELECT private.is_admin((SELECT auth.uid()))))) OR ((SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "redemptions active only" ON "public"."redemptions"
  WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

ALTER POLICY "redemptions admin update" ON "public"."redemptions"
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "redemptions own insert" ON "public"."redemptions"
  WITH CHECK (((member_id = (SELECT auth.uid())) AND (status = 'pending'::text)));

ALTER POLICY "redemptions read" ON "public"."redemptions"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "rewards admin insert" ON "public"."rewards"
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "rewards admin update" ON "public"."rewards"
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

ALTER POLICY "rewards read" ON "public"."rewards"
  USING ((active OR (SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "favorites own delete" ON "public"."saved_meals"
  USING ((member_id = (SELECT auth.uid())));

ALTER POLICY "favorites own insert" ON "public"."saved_meals"
  WITH CHECK (((member_id = (SELECT auth.uid())) AND (SELECT private.is_active((SELECT auth.uid())))));

ALTER POLICY "favorites own read" ON "public"."saved_meals"
  USING ((member_id = (SELECT auth.uid())));

ALTER POLICY "favorites own update" ON "public"."saved_meals"
  USING ((member_id = (SELECT auth.uid())))
  WITH CHECK (((member_id = (SELECT auth.uid())) AND (SELECT private.is_active((SELECT auth.uid())))));

ALTER POLICY "Delete own sets" ON "public"."set_logs"
  USING ((member_id = (SELECT auth.uid())));

ALTER POLICY "Insert own sets in own open session" ON "public"."set_logs"
  WITH CHECK (((member_id = (SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM workout_sessions s
  WHERE ((s.id = set_logs.session_id) AND (s.member_id = (SELECT auth.uid())) AND (s.finished_at IS NULL))))));

ALTER POLICY "Update own sets" ON "public"."set_logs"
  USING ((member_id = (SELECT auth.uid())))
  WITH CHECK ((member_id = (SELECT auth.uid())));

ALTER POLICY "View own or managed sets" ON "public"."set_logs"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "active members only" ON "public"."set_logs"
  WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

ALTER POLICY "shields own insert" ON "public"."streak_shields"
  WITH CHECK (((member_id = (SELECT auth.uid())) AND (SELECT private.is_active((SELECT auth.uid())))));

ALTER POLICY "shields own read" ON "public"."streak_shields"
  USING ((member_id = (SELECT auth.uid())));

ALTER POLICY "admins grant non-admin roles" ON "public"."user_roles"
  WITH CHECK ((((SELECT private.is_admin((SELECT auth.uid()))) AND (role = ANY (ARRAY['member'::app_role, 'coach'::app_role, 'pod_leader'::app_role]))) OR (SELECT private.has_role((SELECT auth.uid()), 'super_admin'::app_role))));

ALTER POLICY "admins revoke non-admin roles" ON "public"."user_roles"
  USING ((((SELECT private.is_admin((SELECT auth.uid()))) AND (role = ANY (ARRAY['member'::app_role, 'coach'::app_role, 'pod_leader'::app_role]))) OR ((SELECT private.has_role((SELECT auth.uid()), 'super_admin'::app_role)) AND (user_id <> (SELECT auth.uid())))));

ALTER POLICY "read own roles" ON "public"."user_roles"
  USING (((user_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid())))));

ALTER POLICY "active members only" ON "public"."water_logs"
  WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

ALTER POLICY "water own delete" ON "public"."water_logs"
  USING ((member_id = (SELECT auth.uid())));

ALTER POLICY "water own insert" ON "public"."water_logs"
  WITH CHECK ((member_id = (SELECT auth.uid())));

ALTER POLICY "water read" ON "public"."water_logs"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "Delete own unfinished sessions" ON "public"."workout_sessions"
  USING (((member_id = (SELECT auth.uid())) AND (finished_at IS NULL)));

ALTER POLICY "Insert own sessions" ON "public"."workout_sessions"
  WITH CHECK ((member_id = (SELECT auth.uid())));

ALTER POLICY "Update own sessions" ON "public"."workout_sessions"
  USING ((member_id = (SELECT auth.uid())))
  WITH CHECK ((member_id = (SELECT auth.uid())));

ALTER POLICY "View own or managed sessions" ON "public"."workout_sessions"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "active members only" ON "public"."workout_sessions"
  WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

ALTER POLICY "xp read" ON "public"."xp_events"
  USING (((member_id = (SELECT auth.uid())) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), member_id)));

ALTER POLICY "progress photos own delete" ON "storage"."objects"
  USING (((bucket_id = 'progress-photos'::text) AND ((storage.foldername(name))[1] = ((SELECT auth.uid()))::text)));

ALTER POLICY "progress photos own upload" ON "storage"."objects"
  WITH CHECK (((bucket_id = 'progress-photos'::text) AND ((storage.foldername(name))[1] = ((SELECT auth.uid()))::text) AND (SELECT private.is_active((SELECT auth.uid())))));

ALTER POLICY "progress photos read" ON "storage"."objects"
  USING (((bucket_id = 'progress-photos'::text) AND (((storage.foldername(name))[1] = ((SELECT auth.uid()))::text) OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.manages_member((SELECT auth.uid()), ((storage.foldername(name))[1])::uuid))));

-- Split coach_assignments's ALL policy so SELECT has only one permissive policy.
DROP POLICY "coach assignments admin write" ON "public"."coach_assignments";
CREATE POLICY "coach assignments admin write (insert)" ON "public"."coach_assignments" AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "coach assignments admin write (update)" ON "public"."coach_assignments" AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "coach assignments admin write (delete)" ON "public"."coach_assignments" AS PERMISSIVE
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))));
-- Split nutrition_targets's ALL policy so SELECT has only one permissive policy.
DROP POLICY "targets write" ON "public"."nutrition_targets";
CREATE POLICY "targets write (insert)" ON "public"."nutrition_targets" AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (((SELECT private.is_admin((SELECT auth.uid()))) OR (EXISTS ( SELECT 1
   FROM coach_assignments c
  WHERE ((c.coach_id = (SELECT auth.uid())) AND (c.member_id = nutrition_targets.member_id) AND c.active)))));
CREATE POLICY "targets write (update)" ON "public"."nutrition_targets" AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING (((SELECT private.is_admin((SELECT auth.uid()))) OR (EXISTS ( SELECT 1
   FROM coach_assignments c
  WHERE ((c.coach_id = (SELECT auth.uid())) AND (c.member_id = nutrition_targets.member_id) AND c.active)))))
  WITH CHECK (((SELECT private.is_admin((SELECT auth.uid()))) OR (EXISTS ( SELECT 1
   FROM coach_assignments c
  WHERE ((c.coach_id = (SELECT auth.uid())) AND (c.member_id = nutrition_targets.member_id) AND c.active)))));
CREATE POLICY "targets write (delete)" ON "public"."nutrition_targets" AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (((SELECT private.is_admin((SELECT auth.uid()))) OR (EXISTS ( SELECT 1
   FROM coach_assignments c
  WHERE ((c.coach_id = (SELECT auth.uid())) AND (c.member_id = nutrition_targets.member_id) AND c.active)))));
-- Split pod_members's ALL policy so SELECT has only one permissive policy.
DROP POLICY "pod members admin write" ON "public"."pod_members";
CREATE POLICY "pod members admin write (insert)" ON "public"."pod_members" AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "pod members admin write (update)" ON "public"."pod_members" AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "pod members admin write (delete)" ON "public"."pod_members" AS PERMISSIVE
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))));
-- Split pods's ALL policy so SELECT has only one permissive policy.
DROP POLICY "pods admin write" ON "public"."pods";
CREATE POLICY "pods admin write (insert)" ON "public"."pods" AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "pods admin write (update)" ON "public"."pods" AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "pods admin write (delete)" ON "public"."pods" AS PERMISSIVE
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))));
-- Split program_assignments's ALL policy so SELECT has only one permissive policy.
DROP POLICY "assignments admin write" ON "public"."program_assignments";
CREATE POLICY "assignments admin write (insert)" ON "public"."program_assignments" AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "assignments admin write (update)" ON "public"."program_assignments" AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "assignments admin write (delete)" ON "public"."program_assignments" AS PERMISSIVE
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))));
-- Split program_items's ALL policy so SELECT has only one permissive policy.
DROP POLICY "items admin write" ON "public"."program_items";
CREATE POLICY "items admin write (insert)" ON "public"."program_items" AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "items admin write (update)" ON "public"."program_items" AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "items admin write (delete)" ON "public"."program_items" AS PERMISSIVE
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))));
-- Split programs's ALL policy so SELECT has only one permissive policy.
DROP POLICY "programs admin write" ON "public"."programs";
CREATE POLICY "programs admin write (insert)" ON "public"."programs" AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "programs admin write (update)" ON "public"."programs" AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "programs admin write (delete)" ON "public"."programs" AS PERMISSIVE
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))));
-- Split pv_tasks's ALL policy so SELECT has only one permissive policy.
DROP POLICY "tasks admin write" ON "public"."pv_tasks";
CREATE POLICY "tasks admin write (insert)" ON "public"."pv_tasks" AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "tasks admin write (update)" ON "public"."pv_tasks" AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY "tasks admin write (delete)" ON "public"."pv_tasks" AS PERMISSIVE
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin((SELECT auth.uid()))));

-- Cover every reported foreign key, including reverse lookups and cascades.
CREATE INDEX "coach_assignments_member_id_idx" ON "public"."coach_assignments" ("member_id");
CREATE INDEX "exercises_created_by_idx" ON "public"."exercises" ("created_by");
CREATE INDEX "invites_coach_id_idx" ON "public"."invites" ("coach_id");
CREATE INDEX "invites_invited_by_idx" ON "public"."invites" ("invited_by");
CREATE INDEX "invites_pod_id_idx" ON "public"."invites" ("pod_id");
CREATE INDEX "member_badges_badge_code_idx" ON "public"."member_badges" ("badge_code");
CREATE INDEX "pods_leader_id_idx" ON "public"."pods" ("leader_id");
CREATE INDEX "program_assignments_program_id_idx" ON "public"."program_assignments" ("program_id");
CREATE INDEX "program_items_exercise_id_idx" ON "public"."program_items" ("exercise_id");
CREATE INDEX "pv_claims_member_id_idx" ON "public"."pv_claims" ("member_id");
CREATE INDEX "pv_claims_task_id_idx" ON "public"."pv_claims" ("task_id");
CREATE INDEX "pv_ledger_member_id_idx" ON "public"."pv_ledger" ("member_id");
CREATE INDEX "pv_ledger_redemption_id_idx" ON "public"."pv_ledger" ("redemption_id");
CREATE INDEX "redemptions_reward_id_idx" ON "public"."redemptions" ("reward_id");
CREATE INDEX "set_logs_exercise_id_idx" ON "public"."set_logs" ("exercise_id");
