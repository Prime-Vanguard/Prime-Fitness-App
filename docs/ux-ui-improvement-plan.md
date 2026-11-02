# Prime Fitness UX/UI Improvement Plan

Date: October 29, 2026
Status: Implementation in progress. Workout, member, coach and administration interface slices are implemented locally; the full programme and release gates are not complete. Includes the full Gym Visual catalogue licensed by the user.

### Implementation progress — October 31, 2026

- [x] Distinct authentication context, compact mobile branding and mode-change heading focus with preserved email and password clearing.
- [x] Guided onboarding with labeled native controls, retained backward navigation, consent review, guarded acknowledged saving and assigned/unassigned program next actions.

- [x] Separate Workout, Program and History sections; hide planning/history while a workout is active.
- [x] Focused exercise cards with grouped completed sets, same-ID editing, deletion Undo, a next-set editor and preserved draft inputs.
- [x] Five primary mobile tabs, header Profile access and a persistent minimized-workout Resume bar.
- [x] Compact rest controls, timestamp-based holds, finish review, recovery export and explicit schedule-move saving.
- [x] Guard sync acknowledgements against newer local edits and deletion Undo; require a returned row before declaring a set synced.
- [x] Explicit notification read actions and larger shared form/button touch targets.
- [x] Separate durable planned working-set rows, slot-based supersets (including repeated exercises), offline previous-performance references and per-slot rest preferences.
- [x] Refresh-safe timed holds attached to planned rows; editor/row/superset preservation in personal backups.
- [x] Static thumbnail/fallback controls in workout cards and exercise discovery, with explicit GIF/image/video playback in the detail sheet.
- [x] Extend thumbnails to program-preview rows and expandable workout-history details, preserving frozen names and measurement conventions.
- [x] Connect all 1,324 pinned Gym Visual image/GIF references; use explicit source IDs or unique exact name/equipment matches, branded navy/silver/gold artwork and on-demand GIF playback.
- [x] Server-filtered workout-title/date history search, Cairo/DST-aware date boundaries, validated section/filter/page/session URLs and linked-workout recovery outside the current results.
- [x] First Today/Nutrition member-page slice: daily actions before gamification, compact agenda, shared local-first fuel totals, date navigation and one Search/Recent/Favorites/Quick macros sheet.
- [x] Same-ID food entry editing and durable deletion Undo before/after sync, including refresh, lost-response retries, cross-tab stale edits and personal-backup recovery.
- [x] First Progress, Rewards and Profile section layouts with validated URL state, scoped reads, retained Body/Photos drafts and guarded Profile preference/password changes.
- [x] Portion multipliers with consumed-total previews, canonical saved totals and matching custom-favorite quantities.
- [x] Water-entry editing and durable deletion Undo, including offline/native paths, revision guards, refresh and backup recovery.
- [x] Branded reward request review with cost, balance, remaining-balance estimate and explicit same-request retry confirmation.
- [x] Measurement-entry sheets with dated/unit-specific drafts, native retry reconciliation, history tables and separate weight/waist/body-fat trends.
- [x] Separate weighted load conventions, review source sets and imported dates, label timed/bodyweight/side records and defer chart code with table fallbacks.
- [x] First coach member workspace: scoped Overview / Training / Nutrition / Check-ins / Photos, complete expandable set logs, private measurement history and current-staff access checks.
- [x] Searchable coach/Pod roster with URL-backed filters/pages, complete membership discovery, server XP totals and bounded exact summaries for visible members.
- [x] Loaded scheduling defaults, per-exercise policy drafts, branded change review, explicit override actions and revision-guarded policy saves.
- [x] First admin member/target refinements: access/role filters, consequential-action reviews, fresh admin preflights, searchable target selection, per-member drafts and conditional target saves with acknowledgement recovery.
- [x] Pod administration: summary/count cards, searchable separate rosters, reviewed leader/member changes, conditional stale-state protection, same-request creation recovery, retained drafts and visible operation/read feedback.
- [x] Invitation administration: status/search/date views, creation versus delivery clarity, reviewed revocation, fresh privilege checks and same-request recovery.
- [x] PV review/task workspaces: separate queues, focused evidence/decision review, retained drafts, conditional saves, server award receipt reconciliation and locally tested paused-admin restrictions. The forward migration still requires deployment before live acceptance.
- [x] Program/session administration: searchable list, validated week/day URLs, isolated row drafts, searchable exercise selection, strict prescription inputs, reviewed copy/publication and separate frozen-version assignment review. Forward migration provides stale-preview protection, retry-safe publication and active-admin mutation restrictions; deployment remains pending.
- [x] Structured exercise administration: paged complete catalogue search, visibility/editorial/muscle filters, Identity / Classification / Guidance / Media rights / Alternatives sections, per-exercise drafts, completeness checks, conditional saves and reviewed archive/restore. Active-program coverage reads unique frozen versions and reports unavailable metadata explicitly. Full media/content review remains outstanding.
- [x] Shop administration: separate fulfillment/catalogue views, complete searchable reads, status/page URLs, retained review notes, original-cost refund previews, conditional decisions, server-receipt retry reconciliation and stable reward creation. Forward migration adds paused-admin write restrictions; deployment remains pending.
- [x] Analytics refinements: mobile member summaries, URL-backed search/access/sort/page state, KPI definitions and Cairo periods, deferred bounded audit search, fresh export authorization and complete-roster CSV status/error feedback.
- [x] October 31 supporting flows: File / Mapping / Review / Import / Receipt wizard, searchable mappings, explicit exclusion accounting, locked submitted batches and durable receipt totals across partial retries. Existing formats, duplicate protection and reward exclusions are preserved.
- [x] Backup/restore review: verified owner/project/version/units, photo and record counts, pending-operation summary, explicit restore acknowledgement, retained retry previews and account-switch isolation.
- [x] Sync/conflict review: labeled device/server fields and differences, status/category counts, reviewed conflict decisions with stale-snapshot guards, technical details behind an expander and guarded device-data removal preserving unresolved reward requests.
- [ ] Complete remaining member refinements, admin workflows and backend/pilot acceptance gates.
- [ ] Complete the remaining member, coach and admin page redesigns and shared conflict/import/backup workflows.
- [ ] Complete exercise-by-exercise mapping/content review and managed hosting/offline-media delivery for the full licensed catalogue. Current visuals use pinned upstream assets; unmatched exercises retain the fallback.
- [ ] Complete staff/pilot rollout, moderated usability measurements and physical iOS/Android acceptance.

See [the first implementation report](ux-ui-implementation.md) for scope, verification and remaining work. These checkmarks describe implemented capabilities, not completion of the phase-wide acceptance gates below.

## 1. Direction, evidence and success criteria

Redesign Prime Fitness around its main user tasks: **know what to do next, record it quickly, correct mistakes easily, and trust that it was saved.**

Agreed direction:

- Keep Prime Vanguard’s navy, gold, crests and bilingual identity.
- Use **exercise cards with editable set rows** for workout logging.
- Introduce **focused workout mode**, with explicit Minimize and Resume controls.
- Use five mobile tabs: **Today, Train, Nutrition, Progress, Rewards**. Access Profile through the header avatar.
- Cover member, coach, admin, authentication and supporting workflows.
- Include the full licensed Gym Visual exercise image/GIF catalogue, with Prime Vanguard branding and staged editorial review.

This plan is grounded in current source inspection and existing mobile screenshots dated October 28, 2026. It is a heuristic audit; fresh interactive and physical-device usability testing belongs in the validation phase.

### Research applied

- **Make previous performance visible.** Showing recognizable information reduces memory demands. Apply this through previous-set references, clear targets and recent selections. [Nielsen Norman Group](https://www.nngroup.com/articles/recognition-and-recall/)
- **Keep advanced tools available without crowding the main task.** Put infrequently used controls in clearly labeled menus and sheets. [Progressive disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/)
- **Keep sets and rest together.** Hevy demonstrates exercise-based logging with previous values; Strong keeps the running rest timer readily accessible. These are useful interaction references, rather than proof of better outcomes for Prime members. [Hevy logging](https://www.hevyapp.com/features/track-workouts/), [Strong rest timer](https://help.strongapp.io/article/231-rest-timer)
- **Make controls and feedback accessible.** Use generous touch targets, visible focus, persistent field errors and corrective instructions. WCAG’s AA minimum target criterion is 24 CSS pixels subject to exceptions; Prime’s design target will be at least 44 pixels for interactive controls. [W3C target guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [form feedback](https://www.w3.org/WAI/tutorials/forms/notifications/)

**Acceptance targets**

- Resume an active workout with one action from any member page.
- Start the next assigned session within two actions from Today.
- Complete a prefilled set with one action; changing weight and reps requires no additional modal.
- Edit a logged set without deleting and recreating it.
- Show the current exercise, next set and rest status without searching through unrelated content.
- Never display missing/loading data as a confirmed zero.
- Preserve all existing workout, offline, permission and reward protections.

## 2. Workout tab and logging redesign

### A. Separate planning from training

**Current issues:** The full program and agenda precede the active logger. Program-day buttons, occurrence starts and free workouts compete. History shares the same long page.

Replace this with three Train sections:

| Section               | Content and behavior                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Workout** — default | Active-session Resume card, otherwise the next assigned session with exercise preview and primary Start action. Start empty workout remains secondary. |
| **Program**           | Current frozen program, selected week, session details and agenda. Clearly distinguish scheduled, overdue, completed and repeated sessions.            |
| **History**           | Searchable, paginated sessions with date, duration where known, exercise/set summary and imported label. Open details before choosing Repeat.          |

When scheduling is enabled, starting an assigned session must use its occurrence. Remove the competing program-start path that can bypass schedule tracking. Keep the legacy program-start behavior for accounts where scheduling is unavailable.

Moving a session opens a date sheet with **Save/Cancel**; selecting a date must not immediately mutate the schedule. Explain that other sessions will stay on their dates.

### B. Focused active-workout screen

Use a dedicated active-session presentation containing:

1. Compact header: workout title, elapsed time, completed working sets, save status, Minimize and Finish.
2. Exercise cards in session order, with the active card expanded.
3. Compact rest control anchored above the safe area.
4. Session overview and exercise tools in secondary sheets.

Hide ordinary bottom navigation while focused. Minimize restores navigation and a persistent Resume bar without ending the workout. Browser Back minimizes the workout; it must never discard it.

Do not stack separate fixed navigation, Finish and rest bars. Use one coordinated action region that adapts to the keyboard and safe-area inset.

### C. Exercise cards and set rows

Each expanded exercise card shows:

- Exercise name, equipment and explicit load convention.
- A branded static exercise thumbnail beside the name, with tap-to-open demonstration playback.
- Prescribed target and a concise coach suggestion, when enabled.
- Previous completed performance with its date.
- Planned and completed set rows.
- Add set and an exercise-options menu.

**Set row layout:** set number/type, previous result, weight, reps or duration, completion control. On narrow screens, place the previous result beneath the row rather than compressing inputs.

**Visual beside every exercise:** Include a 56–64px static thumbnail beside each exercise name in workout cards, program previews, exercise discovery and workout-history details. Use the correctly mapped, reviewed Gym Visual poster inside a navy/gold Prime Vanguard frame. Keep the thumbnail separate from the card expand/collapse button so it is keyboard accessible without nested controls. Tapping it opens that exercise's demonstration without selecting/swapping an exercise, changing a target or interrupting the active workout. Only one demonstration viewer is open at a time.

Do not load GIFs or videos as thumbnails or autoplay them in lists. Load the full GIF/image/video only after an explicit action. Reduced-motion mode opens on a static poster with a separate Play control. GIF playback has an explicit stop/replay action, videos retain accessible native controls, and closing the viewer stops/unmounts the media. Missing, unreviewed, offline or failed posters use a fixed-size exercise-icon fallback, preserving layout and access to written guidance. Optional media failure must never disable logging. Every published animated asset needs a reviewed static poster; thumbnails and media require English/Arabic labels and phone/RTL checks.

Behavior:

- Planned rows are **unchecked targets**, not saved completed logs.
- Coach targets determine prescribed reps/duration; member-entered drafts take precedence.
- Prefill load from compatible completed performance when available. Label its source and leave unknown values blank.
- Never prefill actual RPE. Offer an accessible effort picker with short explanations.
- Show RPE inline when coach progression uses it; otherwise place it in set options.
- Completing a row persists it locally before showing the completed state or feedback.
- Completed rows support Edit; saving updates the same set UUID.
- Deleting a set offers Undo. Deleting a root drop set explicitly includes its dependent segments.
- Preserve exercise-card and input state when switching exercises, minimizing, refreshing or changing language.

Previous performance must match exercise, logging mode, load convention and side. Prefer the same program slot; label any compatible fallback. Exclude unfinished sessions, warm-ups and drop segments from the default working-set reference. Keep imported history labeled and separate from coach progression eligibility.

### D. Advanced logging without clutter

| Tool             | Redesigned interaction                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Timed holds      | Start/Stop control beside duration, outside the advanced menu. Persist timestamps and retain the captured duration until confirmed.   |
| Unilateral sets  | Clearly labeled left/right rows with pair status; “Copy left to right” remains explicit.                                              |
| Drop sets        | “Add drop segment” under a working set; visually nest segments beneath their root.                                                    |
| Warm-ups         | Preview generated sets, then add unchecked warm-up rows. Never mark them completed automatically.                                     |
| Supersets        | Pair exercise slots through the exercise menu; show A1/A2 labels and the next exercise. Shared rest begins after the second exercise. |
| Swapping         | Search sheet prioritizing approved alternatives and equipment differences. Preserve prior sets and require explicit selection.        |
| Plate calculator | Sheet launched from the load field or exercise menu, using current units and load.                                                    |
| Instructions     | Detail sheet from the exercise title, retaining approved-media and attribution rules.                                                 |

Move the full exercise library out of the logging form. Open it only through **Add exercise**, **Swap** or exercise details. Translate raw classifications such as `weighted_reps` into member-facing labels.

### E. Rest, finish and recovery

- Keep a compact timer visible with **−15 seconds, +15 seconds, Skip** and an expandable duration control.
- Remember rest preference by exercise slot, with a device default; preserve current settings during upgrade.
- Timer updates must not rerender every input or interrupt screen-reader output.
- After a set, highlight the next row without unexpectedly opening the keyboard or moving focus.
- Finish opens a review sheet showing completed work, unfinished targets, partial unilateral pairs and notes.
- Allow finishing an incomplete prescription after explicit review; explain reward eligibility without implying that extra sets earn extra XP.
- Show separate states for **saved on device**, **syncing**, **confirmed**, and **needs attention**.
- After offline finish, show a local summary and Resume sync control. Display XP only after server confirmation.
- Keep discard in the session menu with an explicit destructive confirmation.

## 3. Improvements across every other page

Every page receives the shared accessibility, feedback, responsive-layout and localization work—not only new colors.

| Page or workflow                     | Findings and planned changes                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Today**                            | Full agenda and gamification compete with daily actions. Lead with Resume/Next workout, followed by food, water and check-in shortcuts. Use a compact weekly agenda; place quests, rank and shields below core tasks. Derive pending totals from the same local-first records used by logging pages.                                                                                                         |
| **Nutrition**                        | Search, macro entry, favorites and water compete vertically. Use date navigation, a compact daily summary and meal sections with Add food actions. Open **Search / Recent / Favorites / Quick macros** in one sheet. Add persistent labels, clear serving quantities and inline validation. Provide entry editing and deletion Undo through existing write paths. Keep water controls beside water progress. |
| **Progress: Overview**               | Separate summary from data entry. Show selected-period workout consistency and volume, with definitions and useful empty states. Avoid loading the entire historical dataset just to render the first screen.                                                                                                                                                                                                |
| **Progress: Strength**               | Search exercises, select period and choose compatible metrics. Separate estimated 1RM, repetitions and timed records. Label imported records and provide an accessible table equivalent for charts.                                                                                                                                                                                                          |
| **Progress: Body & wellness**        | Move measurement entry into a labeled sheet, with date and units always visible. Present measurement trends separately from sleep, energy and soreness. Explain scale values and who can see check-ins.                                                                                                                                                                                                      |
| **Progress: Photos**                 | Preserve older-photo pagination and URL recovery. Use a gallery-first layout and an explicit Compare action. Select two dated photos through thumbnail pickers; default earlier photo to Before and show dates clearly. Retain keyboard slider access and missing-image retry controls.                                                                                                                      |
| **Rewards: Journey**                 | Replace the long combined page with **Journey / Shop / Community / Activity** sections. Journey opens around the member’s current level and next milestone; expand the full roadmap on demand. Keep million-XP thresholds and rank ranges unchanged.                                                                                                                                                         |
| **Rewards: Shop**                    | Show balance, cost, availability and affordability together. Use a branded confirmation sheet showing expected remaining balance. Keep unresolved purchases prominent and preserve durable request IDs through retries.                                                                                                                                                                                      |
| **Rewards: Community**               | Group Pod feed and leaderboard, with visible Pod/week filters. Explain opt-in visibility beside sharing controls. Keep wellness, photos and measurements excluded.                                                                                                                                                                                                                                           |
| **Rewards: Activity**                | Group tasks, claims, redemption receipts and XP history with readable statuses, dates and next actions. Keep XP and PV visibly distinct.                                                                                                                                                                                                                                                                     |
| **Profile**                          | Replace the long mixed form with **Account / Preferences / App & offline / Data & privacy** sections. Add per-section Save state and unsaved-change handling. Reuse accessible password controls and persistent validation.                                                                                                                                                                                  |
| **Imports**                          | Turn the current dense form into **File → Mapping → Review → Import → Receipt**. Use searchable mapping controls, unresolved counts and explicit exclusions. Explain disabled actions. Replace raw receipt JSON with accepted/skipped/rejected counts and resumable progress.                                                                                                                                |
| **Backup and restore**               | Show owner, format version, record counts and pending changes before restoration. Clearly separate validation, preview and restore. Explain retained imported provenance and any unsupported content.                                                                                                                                                                                                        |
| **Offline/sync center**              | Replace raw JSON as the primary conflict UI with labeled local/server fields and highlighted differences. Retain technical details behind an expander. Show queue categories and actionable errors; preserve the unresolved-redemption block on device-data removal.                                                                                                                                         |
| **Notifications**                    | Distinguish loading, empty and failed states. Stop marking everything read merely because the popover closed. Add explicit Mark all read and mark an item read when opened. Keep failure feedback visible.                                                                                                                                                                                                   |
| **Sign-in, invitation and recovery** | Preserve existing validation, password visibility, cooldowns and recovery handling. Reduce excess vertical space on short screens, retain entered email between related modes, and make invitation/confirmation/recovery states visually distinct. Keep email LTR in Arabic.                                                                                                                                 |
| **Onboarding**                       | Add properly associated labels, radio-group semantics, named steps, inline errors and pending-submit protection. Preserve values when moving backward. End with a clear next action for members with or without an assigned program.                                                                                                                                                                         |
| **Coach member list**                | Replace the horizontally scrolling mobile table with member cards; retain a sortable desktop table. Add search and existing-data filters for recent activity, program and Pod. Preserve filters after opening a member.                                                                                                                                                                                      |
| **Coach member detail**              | Use **Overview / Training / Nutrition / Check-ins / Photos** sections. Expand full workout details instead of truncating sets into one text paragraph. Distinguish unavailable, unauthorized and failed data. Preserve role-specific visibility.                                                                                                                                                             |
| **Coach progression and scheduling** | Show only fields relevant to Off, Double progression or Duration. Explain increment units, required evidence, current policy and override status. Preview changes before saving and clearly separate policy from frozen prescription.                                                                                                                                                                        |
| **Admin members**                    | Make member summary the default; move access, roles and coach assignment into an explicit management panel. Preview consequential changes and protect against duplicate submissions. Preserve roster search/pagination and self/super-admin restrictions.                                                                                                                                                    |
| **Admin programs**                   | Use a searchable program list and week/day builder. Show one selected session at a time, searchable exercise selection and editable rows. Preview copy operations and assignments. Clearly distinguish editable program content from assigned frozen versions.                                                                                                                                               |
| **Admin exercises**                  | Use searchable/filterable catalogue rows and a structured editor: Identity, Classification, Guidance, Media rights, Alternatives. Display editorial completeness and unresolved requirements. Keep internal media preview visibly separate from member-approved demonstrations.                                                                                                                              |
| **Admin targets**                    | Use a searchable member picker, clear current values and persistent units. Show changed fields and a save summary. Avoid cramming all targets into six narrow columns at tablet widths.                                                                                                                                                                                                                      |
| **Admin Pods**                       | Show Pod summary and member count first; open roster management separately. Use searchable add-member controls and explicit leader changes, with visible per-operation feedback.                                                                                                                                                                                                                             |
| **Admin invitations**                | Add status filters, expiry/acceptance dates and search. Make successful invitation creation distinguishable from email delivery guarantees. Confirm revocation and retain persistent send errors.                                                                                                                                                                                                            |
| **Admin PV approvals**               | Separate review queue from task management. Provide Pending/Needs information/Reviewed filters and a focused review panel with member evidence, points and decision reason. Preserve self-approval restrictions.                                                                                                                                                                                             |
| **Admin shop**                       | Separate fulfillment queue from reward catalogue. Show cost, stock and fulfillment status clearly. Preview rejection/refund consequences and confirm decisions through existing guarded operations.                                                                                                                                                                                                          |
| **Admin analytics**                  | Add clear date/freshness context, readable KPI definitions and mobile summary cards. Keep desktop tables, export status and audit filters. Preserve existing complete-roster exports and failed-refresh protection.                                                                                                                                                                                          |

## 4. Shared implementation and compatibility

### Full licensed Gym Visual catalogue

The user has confirmed that Gym Visual media is licensed and authorized use of the full catalogue. Catalogue coverage is not limited to exercises in currently assigned programs. Record the supplied license and its applicable modification, hosting, caching, download and attribution terms alongside the assets; the precise license document has not yet been reviewed in this plan.

**Catalogue ingestion and mapping**

- Inventory the full licensed image/GIF collection and retain stable source exercise IDs, asset IDs, original filenames, source references and required attribution.
- Use the licensed asset delivery source for ingestion. Reconcile dataset reference IDs with the supplied catalogue rather than assuming every referenced file is covered or available at the same URL.
- Map assets to existing stable Prime Fitness exercise IDs. Detect duplicate names and variants before creating additional catalogue entries.
- Create additional exercise entries with bilingual names or visible translation-review status, aliases, equipment, muscles, movement pattern, logging mode and load convention.
- Track review states separately from asset import. Unreviewed exercises remain outside member selection until exercise mapping, guidance and measurement conventions are verified.
- Review active-program exercises first, then release the remaining catalogue in batches. Maintain an auditable report of imported, mapped, duplicate, missing and reviewed items so the full catalogue is accounted for.

**Prime Vanguard branding**

- Produce navy, gold and silver variants wherever the license permits modification. Preserve exercise mechanics, framing, frame timing, anatomical highlights and instructional contrast.
- Retain immutable originals separately from generated variants. Version transformation settings and keep a manifest linking each variant to its source.
- Where an asset cannot be modified under its terms, apply branding to the surrounding demonstration frame and controls.
- Keep required credits and attribution visible in exercise details. Approved licensed assets can move beyond the former internal-only preview; internal previews and unpublished variants remain clearly distinguished.

**Discovery and demonstration UX**

- Make the full reviewed catalogue discoverable through bilingual names, aliases and combined equipment, muscle and logging-mode filters.
- Use paginated results and optimized poster thumbnails. Do not download every GIF or render the entire catalogue when opening Train.
- Publish a reviewed static poster for every exercise demonstration and reuse it beside exercise names across workout, program, library and history surfaces. Full-catalogue thumbnail coverage is part of the media release gate.
- Integrate approved demonstrations into exercise details, program previews and workout instruction sheets. Opening a demonstration must preserve the active workout and draft inputs.
- Load demonstrations on request, with play/pause and replay controls, a static poster, accessible labels and equivalent written instructions. Reduced-motion mode starts with the poster and requires explicit playback.
- Offer optional per-exercise media downloads only where permitted by the license. Keep media downloads separate from the critical app-shell installation, show progress and storage use, and provide removal controls.
- Host catalogue assets through a configurable managed source. Do not rely on a third-party repository preview URL as the production media delivery contract.
- Preserve coach control over assigned programs and approved substitutions. Full catalogue access does not automatically make every exercise an approved alternative or transfer progression baselines between exercises.

**Media acceptance gate**

- Every published image/GIF has a matched exercise, documented license coverage, required attribution and reviewed guidance/classification.
- Every catalogue asset is accounted for, including duplicates and withheld items; no silent omissions or duplicate exercise creation.
- Verify animation integrity, poster quality, correct anatomy and exercise matching, mobile legibility, English/Arabic layout, loading performance and playback on physical iOS/Android devices.
- Verify interrupted downloads, cache eviction and offline recovery. Media failure must leave written guidance and workout logging usable.

### Design system and navigation

- Keep existing colors and fonts; standardize spacing, page widths, headings, field labels and card density.
- Reserve gold for primary actions, selection and rank identity; use distinct semantic status treatments.
- Use 16px input text on mobile, at least 44px interactive targets, visible focus and sufficient contrast.
- Use bottom sheets on phones and dialogs/side panels on larger screens, with focus containment and restoration.
- Store section/filter state in validated URL parameters where useful, preserving browser Back and direct links.
- Keep existing route URLs working; `/profile` remains directly accessible despite leaving bottom navigation.
- Support Arabic RTL, long translations, Arabic numerals, reduced motion, 200% zoom and keyboard operation.

### Interfaces and data handling

Extend existing modules rather than replacing proven persistence:

- Add a `WorkoutEditorState` for selected slot, expanded card, incomplete row inputs and presentation mode.
- Add typed commands for **update set, delete/undo set, update draft row, select exercise slot**.
- Keep planned rows separate from completed `SetLogV2` records.
- Address repeated exercises and supersets by stable session-slot identity, rather than exercise ID alone.
- Add a typed previous-performance result containing source workout/date, slot, side, logging mode and load convention.
- Standardize reusable loading, empty, stale, error, save-status and confirmation components.
- Extend shared navigation to support focused mode and a member-scoped Resume indicator.

Use additive, transactional IndexedDB upgrades. Preserve existing drafts, stable IDs, tombstones and backups. Editing must not let an acknowledgment for an older payload mark newer local values as synchronized.

Prefer existing authorized operations. Add forward database migrations only where a required capability is absent; do not alter applied migrations, permissions, reward formulas or imported provenance.

Lazy-load charts, library search, imports and expanded roadmap content. Keep necessary offline assets available before promising offline access. Isolate timer rendering and avoid fetching hidden sections unnecessarily.

## 5. Delivery order and verification

| Phase                          | Deliverable                                                                                                                                                                                                                                        | Release gate                                                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Baseline and design**     | Current-flow measurements, complete page inventory, shared components and responsive mockups covering every page/state. Inventory the full licensed Gym Visual catalogue, record license terms, prepare asset mappings and review branded samples. | Review English/Arabic phone and desktop designs; record baseline task times and errors. Verify media coverage and branding fidelity before publishing variants. |
| **2. Navigation and workouts** | Five tabs, focused mode, exercise cards, edit/undo, rest controls, start consolidation and finish summary. Integrate approved images/GIFs into exercise details and program previews, starting with active-program exercises.                      | Existing drafts recover; logging and sync regression scenarios pass. Reviewed demonstrations load on demand without blocking logging.                           |
| **3. Member pages**            | Today, Nutrition, Progress, Rewards, Profile, authentication, onboarding and supporting flows.                                                                                                                                                     | Each page passes loading/error/offline/empty-state and accessibility checks.                                                                                    |
| **4. Coach and admin**         | Member workspace, progression controls and all administration pages. Complete catalogue review tools and continue releasing the remaining reviewed Gym Visual catalogue in batches.                                                                | Role matrix and consequential-action checks pass. Published assets meet the media acceptance gate; full-catalogue accounting is complete.                       |
| **5. Pilot and refinement**    | Staff testing, invited member/coach pilot and physical-device checks, including catalogue search, demonstration playback and optional offline media.                                                                                               | Usability targets met with no lost records, cross-member exposure or duplicate awards. Media quality, performance and device checks pass.                       |

**Required tests**

- Weighted, bodyweight, timed, warm-up, drop and unilateral logging; duplicate exercise slots and supersets.
- Edit/delete/undo during an in-flight sync, two tabs, reload, offline finish and account switching.
- Local-storage failure must retain input and never claim success.
- Keyboard open/closed, short screens, safe areas, landscape and minimized/resumed workouts.
- Previous-performance compatibility and missing RPE; no accidental completion from prefilled targets.
- Nutrition edits, favorite expansion, water logging, conflicts and totals matching Today.
- Photo selection across pages, URL expiry, missing images and authorized coach access.
- Purchase lost-response retries, repricing and unresolved-request recovery.
- Import cancellation/resume, duplicate review and backup compatibility.
- Keyboard/screen-reader navigation, contrast, touch targets, RTL and reduced motion.
- Full-catalogue asset accounting, duplicate mapping, licensed branded variants, attribution, paginated discovery, on-demand playback and optional offline downloads.
- Existing unit, database, security, progression, reliability, performance, TypeScript, lint, production-build and Playwright checks.

Run moderated tasks with five members spanning beginner and experienced users, plus two coaches/admins. Target at least **90% unassisted completion of core tasks** and a **30% reduction in median logging-task time** against the measured baseline. Treat these as release targets, not predicted results.

**Defaults:** This is a UX/UI programme using the existing backend and product rules. It adds no AI coaching, wearable integration, new reward mechanics or unlicensed media publication. Roll out in stages; a visual rollback must retain the upgraded data and drafts.
