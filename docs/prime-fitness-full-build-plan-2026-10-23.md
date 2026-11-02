# Prime Fitness — Full Build Plan

Prime Fitness is an invite-only fitness, nutrition and accountability web app for Prime Vanguard members. It includes a member app, an admin control center, coach and Pod Leader dashboards, and the official XP, level, rank, PV Points and rewards system. It uses the uploaded brand kit and the real logo.

The scope is very large, so the work is split into 7 phases. Each phase ends with something working that has been checked. I will build them in order and confirm each one before moving on.

## Ground rules (from your documents)

- Brand colors: Navy #0F172A, Gold #D4AF37, Deep Surface #1E293B, Mist #F1F5F9, Gunmetal #334155, Slate #94A3B8, Emerald #10B981. Colors follow a 60/30/10 split, with gold used only as an accent.
- Fonts: Manrope for headings, Inter for body text, Tajawal for Arabic. The app works fully in Arabic (right-to-left) and English, with a language switcher.
- The uploaded logo is used unchanged. It also becomes the favicon.
- XP, levels, ranks and PV Points are separate things and are never mixed up.
- PV Points are added only when an authorized admin approves a specific eligible task. Each one is recorded with its source and is never added automatically.
- XP thresholds for the 100 levels are a draft. They are stored as editable settings and marked "provisional" until you approve the real formula.
- Six ranks: Recruit (levels 1–15), Seeker (16–35), Forged (36–55), Guardian (56–75), Vanguard (76–90), Prime Legend (91–100).
- I will not invent prices, payment integrations or subscription tiers. Access is a membership switch that admins control.
- Health and nutrition safety notices are included. The app gives no medical advice.

## Look and feel — Prime Vanguard premium design

The app should feel like an elite members' club: calm, disciplined and earned. It should not look like a typical bright fitness app.

- **Mood:** dark navy by default (Navy and Deep Surface), with Mist and Slate text. Gold appears only on things you earn: rank badges, level-ups, PV Points, the main action on a screen and key highlights. Emerald means success, such as a completed workout, an approved task or targets met.
- **Light mode:** available. It uses Mist backgrounds and navy text, and gold stays an accent.
- **Typography:** large, confident Manrope headings with tight spacing, Inter for body text and numbers, and Tajawal for Arabic at the same visual weight. Stats like XP, weight and macros use large numbers with aligned digits.
- **Surfaces:** layered navy cards with thin Gunmetal borders, soft depth and a subtle gold glow on earned items. Rounded corners are used with restraint. Spacing is generous and screens are kept uncluttered.
- **Signature elements:**
  - Rank crest: a distinct emblem for each of the six ranks, from Recruit to Prime Legend, increasing in detail and gold intensity.
  - XP bar with a gold fill, showing the current level and the progress to the next one.
  - Progress rings for calories, macros, water and weekly training.
  - A PV Points wallet card styled like a premium membership card.
  - Streak flame with a counter, plus grace and freeze indicators.
- **Moments of reward:** short, tasteful animations for logging a set, finishing a workout, gaining XP, leveling up (a full-screen rank or level reveal), an approved PV submission and redeeming a reward. Animations are reduced when the device asks for reduced motion.
- **Mobile first:** a bottom tab bar for members (Today, Train, Nutrition, Progress, Rewards, Profile), large tap targets for logging sets at the gym, a rest timer you can use with one thumb, and a sticky "Finish workout" bar. On desktop, members get a side rail and admins get a dense sidebar layout.
- **Today screen:** a greeting with the rank crest, today's workout card with a single "Start" button, nutrition rings, the streak, active quests, and pending approvals, in that order.
- **Admin, coach and Pod Leader areas:** the same brand in a denser, data-focused style, with clean tables, filters, status chips (pending, approved, rejected, needs info), charts in brand colors and clear confirmation steps for any action that affects points.
- **Login and onboarding:** a full-bleed navy screen with the logo and a gold hairline accent, followed by short, focused onboarding steps with a progress indicator.
- **States and accessibility:** every screen has branded empty, loading (skeleton) and error states. Text contrast meets WCAG AA on navy. Focus rings are visible. Layouts mirror correctly in Arabic, including icons and progress direction.
- **Imagery:** moody, high-contrast training photography with a navy overlay, used sparingly on the login screen, program covers and empty states.

## Step 0 — Connect your own Supabase project (you do this)
- I can't create projects inside your Supabase organization from chat. Create a project named "Prime Fitness" in your Supabase dashboard. For users in Egypt, the closest region is Frankfurt (eu-central-1), which also matches the main Prime Vanguard app.
- Configure your existing external Supabase project using `.env.example` and `README.md`.
- Development and deployment use the source code directly and your chosen hosting provider.

## Phase 1 — Foundation (core backend first)
- On your Supabase project, I'll set up logins (invite-only, email and password, password reset), member profiles, roles (member, coach, Pod Leader, admin, super admin), admin accounts, coach and pod assignments, and the core tables, with access rules on every table.
- I'll show you each database change and wait for your approval before applying it.
- Build the design system: colors, fonts, light and dark surfaces, and the shared building blocks (buttons, cards, tables, dialogs, progress bars, rank badge, XP bar, PV balance, empty, loading and error states).
- Set up Arabic and English translations, with correct right-to-left layout and local formatting for dates and units.
- Logins: invite-only sign-up, email and password, Google, password reset page, and member onboarding steps.
- Roles in a separate roles table: member, coach, Pod Leader, admin, super admin. Each role sees only what it is allowed to see.
- App layout: member navigation (Today, Train, Nutrition, Progress, Rewards, Profile) and a separate admin navigation.

## Phase 2 — Training
- Exercise library: muscles, equipment, instructions and media. Admins can create and edit exercises.
- Program builder: phases, weeks, days and exercises with sets, reps, weight, rest time, RPE, tempo and notes. Programs are versioned.
- Programs can be assigned to one member or a group, with start dates. Assigned programs keep the version they were given.
- Workout logging: start a session, log each set, rest timer, recover an unfinished session, finish with notes.
- Personal records and exercise history charts.

## Phase 3 — Nutrition and body progress
- Nutrition profile and plan builder: calorie and macro targets, meal templates.
- Food database with sources. Admins verify entries, and members can add their own foods, which stay marked unverified.
- Daily food log: meals, portions, quick-add, copy a previous day, water intake.
- Nutrition dashboard comparing targets with actual intake, plus safety warnings.
- Body progress: weight, measurements, private progress photos and performance tests, with trend charts.

## Phase 4 — Gamification engine
- XP is awarded only by the server, using editable rules. Duplicate awards are blocked.
- Level thresholds are editable, and ranks are worked out from the level.
- Streaks support grace days and freezes. Rules are fixed per day so time zones are handled correctly.
- Achievements and badges, plus daily and weekly challenges and quests.
- PV Points approval center: members submit eligible tasks with proof. Each submission moves through pending, approved, rejected or needs-info. Every decision goes into an audit log. Corrections are made as reversal entries, never by editing past entries.
- Reward shop with stock limits, safe redemption, and admin fulfillment.
- Leaderboards with opt-in privacy and fair grouping.

## Phase 5 — Member experience loop
- Today dashboard: today's workout, nutrition progress, streak, active quests, XP and rank progress, and pending approvals.
- Weekly check-in and summary, plus long-term rank milestones.
- In-app notifications and reminders.

## Phase 6 — Admin, coach and Pod Leader
- Admin control center: members, invites, membership access, workout and nutrition content, the approval queue, gamification settings with change history, the reward catalog, and the audit log.
- Analytics: organization overview, workout, nutrition and gamification metrics, member retention, date filters and CSV export.
- Coach dashboard: assigned members, plan changes, progress review and notes.
- Pod Leader dashboard: their pod's members and accountability tracking. Pod Leaders can confirm progress but cannot award PV Points.

## Phase 7 — Hardening and verification
- Security review of data access rules for every table, plus a security scan.
- Tests for XP, levels, ranks, streaks, PV approval, redemption stock, and role permissions.
- End-to-end checks of the main flows as a signed-in member and as an admin, in both languages.
- Page titles and descriptions, and handling for edge cases.

## Decisions that remain open (temporary handling until you decide)
- Final XP formula: an editable provisional table is used for now.
- Reward prices and point values: editable placeholders for now.
- Prime Fitness access and pricing: an admin switch for now, with no payments.
- Whether to share accounts and the points wallet with the main Prime Vanguard app: balances are labeled as local to Prime Fitness for now.
- Food database source and licensing: admin-verified entries only.
- Default language: Arabic first, unless you say otherwise.
- A legal and privacy review for health data is recommended before launch.

## Technical details
- Stack: TanStack Start, React and TypeScript, Tailwind v4 design tokens, shadcn/ui, TanStack Query, React Hook Form with Zod, and Recharts. This project uses TanStack Start.
- Backend: your own external Supabase project (Postgres, Auth, Storage), with access rules on every table. Trusted work runs in security-definer database functions and in TanStack server functions with auth middleware. These replace Edge Functions, the server pattern this stack recommends; the Supabase project itself remains fully yours. All XP, points and economy writes happen on the server only. Protected pages live behind a sign-in gate.
- Main table groups:
  - identity: profiles, user_roles, invites, memberships, pods, coach_assignments
  - training: exercises, programs, program_versions, program_days, prescriptions, assignments, workout_sessions, set_logs, personal_records
  - nutrition: nutrition_profiles, nutrition_plans, foods, food_logs, water_logs
  - progress: body_metrics, progress_photos (private storage), performance_tests
  - gamification: xp_rules, xp_ledger, level_thresholds, ranks, streaks, achievements, member_achievements, quests, quest_progress, pv_tasks, pv_submissions, pv_ledger, rewards, redemptions
  - operations: notifications, audit_log, settings_history
- Both ledgers can only be added to. Balances are calculated from the ledger entries, and idempotency keys prevent duplicate entries. Role checks use a security-definer has_role function.
- Translations use a typed dictionary. The page direction switches between RTL and LTR on the html element.
