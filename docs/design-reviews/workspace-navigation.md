# Consistent workspace navigation

November 12, 2026. Implemented locally following the owner's approval of explicit
workspace switching. No commit, push, deployment, migration or hosted access change.

## Behavior and structure

`src/features/navigation/workspace.ts` defines route ownership, permission-derived
availability, fixed destination ordering and workspace landing pages. Its companion
`workspace-navigation.tsx` renders both desktop and phone menus. The shared shell
owns responsive chrome, account-scoped presentation preferences and existing sync
components. These menu helpers do not grant database or route permissions.

- My Fitness: Today, Train, Nutrition, Progress, Rewards.
- Staff Workspace for admins: Dashboard, Members, Programs, Exercise library,
  Pods, PV approvals, Reward shop, Invites, Nutrition targets, My members.
- Staff Workspace for coaches/Pod leaders: existing My members destination.
  Members and inactive staff cannot enable staff navigation through a preference.
- Brand, workspace selector and Profile & settings/language/sign-out footer stay
  in the same positions. Only long destination lists scroll independently.
- Notifications precede Profile in both phone and desktop headers.
- Below 768px: drawer plus first five current-workspace shortcuts. From 768px:
  labeled 88px rail. From 1024px: full 240px sidebar. Expanding out of phone layout
  closes the drawer. English/Arabic share the same destination order.
- Workspace selection follows accepted navigation, including existing unsaved
  editor guards. Profile keeps the current workspace through refresh using a
  per-project/member sessionStorage key. Storage is optional and is never trusted
  as permission evidence. Sign-out removes this preference.
- Denied admin pages offer Return to My Fitness. Existing paused-account and
  permission-error behavior remains authoritative.

## Workout focus and recovery

Back to Train opens `/train?view=overview` without discarding the active session.
The hub shows a resumable session card; tabs and history filters preserve the
overview until Continue workout explicitly returns to logging. The validated
query value changes presentation only. The existing workout controller retains
stable session/set identities, actual input values and durable drafts. No second
strength workout starts while the first session is active.

## Verification and limits

Evidence is recorded in ignored `artifacts/workspace-*.log`, responsive matrix JSON
and synthetic `workspace-staff-en.png` / `workspace-staff-ar.png` screenshots.
New checks cover permission-derived menus, workspace ordering, Profile refresh,
drawer/rail resizing, anchored utilities, guarded staff drafts and returning to
the same workout. Regression checks cover responsive routes, staff editor focus,
notifications, Profile guards and durable workout drafts.

Result: 17 distinct Chrome scenarios, seven Windows WebKit scenarios and 12 unit
tests passed. The responsive matrix covered 480 English/Arabic route-size checks.
Final active-style reruns passed in both engines. TypeScript, targeted lint,
formatting, whitespace and Node/Pages production builds passed; Pages verification
checked 20 static routes and 200 public files. Reruns corrected shared trace-folder
cleanup collisions and an incorrect test-server port. No physical-device or hosted
database verification is implied by these local checks.

This intentionally changes navigation relative to earlier Stitch screenshots.
Historical reference coverage remains 11 of 60 frames, 49 pending and none finally
accepted; these workspace checks do not increase comparison coverage. Physical
iOS/Android PWA and screen-reader checks remain release gates. Mocked browser
permission scenarios do not constitute a new hosted RLS audit. There are no new
backend/schema requirements for this presentation change.

Next: controlled active-workout, exercise-selection and history/program
comparisons, then the remaining reference inventory and accessibility/device gates.
