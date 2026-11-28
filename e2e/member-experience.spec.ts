import { test, expect, type BrowserContext, type Page, type Locator } from "@playwright/test";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";

// Phase 5 fixtures use synthetic accounts; captures must never contain real member data.
test("Stitch controlled reference captures", async ({ browser }) => {
  test.skip(!process.env["PW_STITCH_COMPARE"], "Opt-in visual review; no production records.");
  test.setTimeout(120000);
  const requestedStage = process.env["PW_STITCH_STAGE"];
  const stage =
    requestedStage === "after" ||
    requestedStage === "member-baseline" ||
    requestedStage === "review-baseline" ||
    requestedStage === "daily-baseline" ||
    requestedStage === "progress-baseline" ||
    requestedStage === "training-baseline" ||
    requestedStage === "conditioning-baseline" ||
    requestedStage === "picker-calibration-baseline"
      ? requestedStage
      : "before";
  const cases = [
    {
      key: "training-complete",
      reference: "workout_complete_prime_fitness",
      route: "/train?section=program",
      width: 387,
      height: 1422,
      scale: 1.125,
      baselineStage: "conditioning-baseline",
      calibration:
        "1.125 export scale inferred from the 72 px header / h-16 (64 CSS px) and about 50 px Finish button / h-11 (44 CSS px). Rounded CSS frame. Five frozen exercise slots with completed working sets, accepted through the normal finish path. The baseline starts after the completion feature was implemented. Source-only PRs, heart rate, rank transition and proof-card export are not fabricated; the application currently returns to Train with a completion panel.",
    },
    {
      key: "training-cardio",
      reference: "cardio_hiit_prime_fitness",
      route: "/train?section=cardio",
      width: 372,
      height: 1067,
      scale: 1.5,
      rasterHeightTolerance: 1,
      baselineStage: "conditioning-baseline",
      calibration:
        "1.5 export scale inferred from 54 px activity chips / h-9 (36 CSS px), 96 px header / h-16 and the w-52 ring. Rounded height produces one extra raster pixel. Running first round, 45 s work / 15 s rest, 12 rounds, no preparation; 45 recorded recent minutes. Actual duration is 11:45, not the mockup's inconsistent 24:00. Running controls replace the source's Start action; no heart-rate zones or weekly targets are invented.",
    },
    {
      key: "training-active",
      reference: "active_workout_prime_fitness_1",
      route: "/train?section=program",
      width: 390,
      height: 1298,
      scale: 1,
      baselineStage: "training-baseline",
      calibration:
        "Native phone frame. Five frozen exercise slots, one completed 85 kg × 10 set and an editable 90 kg × 8 next set. Static catalogue fallback; source demonstration and coaching notes are unavailable.",
    },
    {
      key: "training-picker",
      reference: "add_exercise_prime_fitness",
      route: "/train",
      width: 392,
      height: 1067,
      scale: 1.5,
      rasterHeightTolerance: 1,
      baselineStage: "picker-calibration-baseline",
      calibration:
        "1.5 export scale inferred from 84 px thumbnail / w-14 (56 CSS px) and 36 px list inset / px-margin (24 CSS px). Rounded 392 × 1067 CSS viewport produces 588 × 1601 PNGs, one pixel taller than the export; preserved without rescaling. Baseline was recaptured after layout refinement to correct the initial scale assumption; no before/after improvement claim for this frame. Two staged selections; source-only features/media are absent.",
    },
    {
      key: "training-program",
      reference: "train_my_program_prime_fitness_2",
      route: "/train?section=program",
      width: 341,
      height: 1600,
      scale: 1,
      baselineStage: "training-baseline",
      calibration:
        "Native phone frame. Six-week frozen assignment with four nonempty days per week. Selected week means browsing, not inferred completion; rest-day/cardio prescriptions and coach doctrine are absent from the fixture.",
    },
    {
      key: "training-history",
      reference: "train_history_prime_fitness_1",
      route: "/train?section=history",
      width: 395,
      height: 1600,
      scale: 1,
      baselineStage: "training-baseline",
      calibration:
        "Native phone frame. Three completed native workouts; latest expanded with frozen exercise snapshots and actual logged sets. Source monthly summaries, PR badges and workout-card export are not available here.",
    },
    {
      key: "progress-strength",
      reference: "progress_strength_prime_fitness",
      route: "/progress?section=strength",
      width: 373,
      height: 1600,
      scale: 1,
      baselineStage: "progress-baseline",
      calibration:
        "Native phone viewport. Two completed weighted performances; source counts, report exports and volume-distribution content differ.",
    },
    {
      key: "progress-body",
      reference: "progress_body_wellness_prime_fitness",
      route: "/progress?section=body",
      width: 425,
      height: 1600,
      scale: 1,
      baselineStage: "progress-baseline",
      calibration:
        "Native phone viewport. Three recorded measurements; application retains a measurement sheet and self-reported wellness. No resting-heart-rate or recovery claims are fabricated.",
    },
    {
      key: "progress-photos",
      reference: "progress_photos_prime_fitness",
      route: "/progress?section=photos",
      width: 445,
      height: 1600,
      scale: 1,
      baselineStage: "progress-baseline",
      calibration:
        "Native phone viewport. Four synthetic test images through mocked signed URLs; no real photos or source-model photos. Privacy and archive controls remain real application flows.",
    },
    {
      key: "staff-members",
      reference: "staff_members_list_prime_fitness",
      route: "/admin/members",
      width: 1280,
      height: 1062,
      scale: 1.25,
      calibration:
        "PNG sidebar is 300 px; exported HTML fixes it at 240 CSS px. 1.25 export scale inferred from that anchor.",
    },
    {
      key: "staff-pods",
      reference: "staff_pods_management_prime_fitness",
      route: "/admin/pods",
      width: 1280,
      height: 1376,
      scale: 1,
      calibration: "Native PNG viewport; sidebar matches the exported 240 CSS px anchor.",
    },
    {
      key: "staff-review",
      reference: "staff_review_queue_prime_fitness",
      route: "/admin/pv",
      width: 1283,
      height: 1333,
      scale: 1.2,
      calibration:
        "1.2 export scale inferred from two anchors: 288 px sidebar / 240 CSS px and about 67 px toolbar / 56 CSS px. Rounded CSS viewport; both captures open the same synthetic claim. Content and typography still differ.",
      baselineStage: "review-baseline",
    },
    {
      key: "train",
      reference: "train_workout_prime_fitness_1",
      route: "/train",
      width: 360,
      height: 1600,
      scale: 1,
      calibration:
        "Native mobile PNG viewport. Member-refinement baseline and current both show the same scheduled five-exercise program. Original free-session baseline remains separate.",
      baselineStage: "member-baseline",
    },
    {
      key: "profile",
      reference: "profile_hub_prime_fitness",
      route: "/profile",
      width: 415,
      height: 1600,
      scale: 1,
      calibration: "Native mobile PNG viewport.",
      baselineStage: "member-baseline",
    },
    {
      key: "today",
      reference: "today_prime_fitness_1",
      route: "/today",
      width: 377,
      height: 1600,
      scale: 1,
      calibration:
        "Native mobile viewport. Scheduled five-exercise program; synthetic food and completed history. Source media and prior-performance content differ.",
      baselineStage: "daily-baseline",
    },
    {
      key: "nutrition",
      reference: "nutrition_daily_hub_prime_fitness",
      route: "/nutrition",
      width: 313,
      height: 1600,
      scale: 1,
      calibration:
        "Native 313 px reference viewport. Three logged meals with actual fixture targets; source totals differ. Offline metadata stays visible.",
      baselineStage: "daily-baseline",
    },
    {
      key: "progress",
      reference: "progress_prime_fitness_1",
      route: "/progress",
      width: 363,
      height: 1600,
      scale: 1,
      calibration:
        "Native mobile overview viewport. Source embeds strength trends/PRs; application keeps them under Strength. This composition gap remains open; metric scopes differ.",
      baselineStage: "daily-baseline",
    },
  ];
  const output = `artifacts/stitch-comparison/${stage}`;
  mkdirSync(output, { recursive: true });
  for (const entry of cases) {
    const selectedKeys = process.env["PW_STITCH_KEYS"]?.split(",");
    if (selectedKeys && !selectedKeys.includes(entry.key)) continue;
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3173",
      viewport: { width: entry.width, height: entry.height },
      deviceScaleFactor: entry.scale,
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    try {
      const backend = await fakeBackend(context);
      seedAdminPods(backend);
      seedPvReviews(backend);
      await trainingFeatures(context, {
        guidance: true,
        cardio: true,
        scheduling: entry.key === "train" || entry.key === "today",
      });
      await context.route("**/rest/v1/rpc/get_cardio_history", (route) =>
        route.fulfill({ json: [] }),
      );
      const version = crypto.randomUUID();
      const names = [
        "Incline Barbell Bench Press",
        "Weighted Dips",
        "Cable Crossover Flyes",
        "EZ-Bar Skullcrushers",
        "Triceps Rope Pushdown",
      ];
      const exercises = names.map((name, position) => ({
        ...backend.tables.exercises![0],
        id: crypto.randomUUID(),
        name_en: name,
        name_ar: name,
        muscle: position < 3 ? "chest" : "triceps",
      }));
      backend.tables.exercises!.push(...exercises);
      const assignment = crypto.randomUUID();
      backend.tables.program_assignments = [
        { id: assignment, member_id: userId, program_version_id: version, active: true },
      ];
      backend.tables.program_schedules = [
        {
          id: crypto.randomUUID(),
          assignment_id: assignment,
          mode: "rotation",
          start_date: "2026-11-12",
        },
      ];
      backend.tables.session_occurrences = [
        {
          id: crypto.randomUUID(),
          assignment_id: assignment,
          program_version_id: version,
          week: 1,
          day: 1,
          ordinal: 0,
          due_date: null,
          status: "scheduled",
        },
      ];
      backend.tables.program_versions = [
        {
          id: version,
          name: "Strength & Hypertrophy II",
          version: 1,
          weeks: 1,
          items: exercises.map((exercise, position) => ({
            ...exercise,
            id: crypto.randomUUID(),
            exercise_id: exercise.id,
            week: 1,
            day: 1,
            position,
            target_sets: position < 2 ? 4 : 3,
            target_reps: position < 2 ? "6–8" : "10–12",
            logging_mode: "weighted_reps",
            load_convention: "external_total",
          })),
        },
      ];
      if (entry.key === "training-program") {
        const template = backend.tables.program_versions[0]!;
        template.weeks = 6;
        template.items = Array.from({ length: 6 }, (_, week) =>
          [1, 2, 4, 6].flatMap((day) =>
            exercises.map((exercise, position) => ({
              ...exercise,
              id: crypto.randomUUID(),
              exercise_id: exercise.id,
              week: week + 1,
              day,
              position,
              target_sets: position < 2 ? 4 : 3,
              target_reps: position < 2 ? "6–8" : "10–12",
              logging_mode: "weighted_reps",
              load_convention: "external_total",
            })),
          ),
        ).flat();
      }
      const page = await context.newPage();
      if (entry.key.startsWith("training-")) {
        await page.clock.setFixedTime(new Date("2026-11-12T10:00:00Z"));
      }
      if (entry.key === "training-history") {
        backend.tables.workout_sessions = [12, 10, 8].map((day, index) => ({
          id: `00000000-0000-4000-8000-00000006300${index}`,
          member_id: userId,
          title: ["Chest & Triceps Density", "Back & Biceps", "Legs & Core"][index],
          origin: "native",
          started_at: `2026-11-${String(day).padStart(2, "0")}T09:00:00Z`,
          finished_at: `2026-11-${String(day).padStart(2, "0")}T09:50:00Z`,
        }));
        backend.tables.workout_exercises = backend.tables.workout_sessions.flatMap((session) =>
          exercises.slice(0, 3).map((exercise, position) => ({
            id: crypto.randomUUID(),
            member_id: userId,
            session_id: session.id,
            exercise_id: exercise.id,
            position,
            snapshot: exercise,
          })),
        );
        backend.tables.set_logs = backend.tables.workout_exercises.flatMap((slot) =>
          [1, 2, 3].map((number) => ({
            id: crypto.randomUUID(),
            member_id: userId,
            session_id: slot.session_id,
            workout_exercise_id: slot.id,
            exercise_id: slot.exercise_id,
            set_number: number,
            reps: 10,
            weight_kg: 60 + number * 5,
            rpe: 8,
            set_role: "working",
            side: "bilateral",
            logging_mode: "weighted_reps",
            load_convention: "external_total",
            created_at: "2026-11-12T09:10:00Z",
          })),
        );
      }
      if (entry.key === "training-cardio") {
        await context.route("**/rest/v1/rpc/get_cardio_history", (route) =>
          route.fulfill({
            json: [
              {
                id: "00000000-0000-4000-8000-000000064000",
                member_id: userId,
                activity: "walk",
                log_date: "2026-11-12",
                duration_seconds: 2700,
                distance_m: null,
                incline_pct: null,
                resistance: null,
                heart_rate: null,
                notes: "",
                intervals: null,
                revision: 1,
                deleted_at: null,
              },
            ],
          }),
        );
      }
      if (entry.key.startsWith("progress-")) {
        await page.clock.setFixedTime(new Date("2026-11-12T10:00:00Z"));
        backend.tables.workout_sessions = ["2026-10-15", "2026-11-12"].map((day, index) => ({
          id: `00000000-0000-4000-8000-00000006200${index}`,
          member_id: userId,
          title: "Synthetic strength session",
          origin: "native",
          started_at: `${day}T10:00:00Z`,
          finished_at: `${day}T10:45:00Z`,
        }));
        backend.tables.set_logs = backend.tables.workout_sessions.map((session, index) => ({
          id: `00000000-0000-4000-8000-00000006201${index}`,
          member_id: userId,
          session_id: session.id,
          exercise_id: exercises[0]!.id,
          reps: 8,
          weight_kg: 80 + index * 10,
          logging_mode: "weighted_reps",
          load_convention: "external_total",
          set_role: "working",
          side: "bilateral",
          created_at: session.started_at,
        }));
        backend.tables.body_measurements = ["2026-10-01", "2026-10-22", "2026-11-12"].map(
          (day, index) => ({
            id: `00000000-0000-4000-8000-00000006202${index}`,
            member_id: userId,
            measured_on: day,
            weight_kg: 85 - index,
            waist_cm: 86 - index,
            body_fat_pct: 20 - index,
          }),
        );
        backend.tables.progress_photos = [
          "2026-10-01",
          "2026-10-15",
          "2026-11-01",
          "2026-11-12",
        ].map((day, index) => ({
          id: `00000000-0000-4000-8000-00000006203${index}`,
          member_id: userId,
          pose: "front",
          taken_on: day,
          created_at: `${day}T12:00:00Z`,
          path: `${userId}/synthetic-${index}.jpg`,
        }));
        await context.route("**/storage/v1/**", async (route) => {
          if (route.request().method() === "POST") {
            const paths = route.request().postDataJSON().paths as string[];
            await route.fulfill({
              json: paths.map((path) => ({
                path,
                signedURL: `/object/sign/progress-photos/${path}?token=synthetic`,
              })),
            });
          } else {
            // Deliberately recognizable test artwork: never capture a real member image.
            await route.fulfill({
              contentType: "image/svg+xml",
              body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#151f33"/><rect x="24" y="24" width="252" height="352" rx="16" fill="none" stroke="#d4af37"/><text x="150" y="195" fill="#f1f5f9" font-family="sans-serif" font-size="18" text-anchor="middle">SYNTHETIC PHOTO</text><text x="150" y="225" fill="#94a3b8" font-family="sans-serif" font-size="14" text-anchor="middle">Visual review fixture</text></svg>',
            });
          }
        });
      }
      if (["today", "nutrition", "progress"].includes(entry.key)) {
        // Stable Cairo activity dates and sanitized, populated daily views for both stages.
        await page.clock.setFixedTime(new Date("2026-11-12T10:00:00Z"));
        backend.tables.food_logs = ["breakfast", "lunch", "dinner"].map((meal, index) => ({
          id: `00000000-0000-4000-8000-00000006100${index}`,
          member_id: userId,
          name: ["Oats & yogurt", "Chicken & rice", "Lentil soup"][index],
          meal,
          log_date: "2026-11-12",
          calories: [500, 650, 400][index],
          protein_g: 40,
          carbs_g: 60,
          fat_g: 14,
          grams: 250,
        }));
        backend.tables.water_logs = [
          {
            id: "00000000-0000-4000-8000-000000061010",
            member_id: userId,
            log_date: "2026-11-12",
            ml: 1750,
          },
        ];
        backend.tables.workout_sessions = [0, 1].map((index) => ({
          id: `00000000-0000-4000-8000-00000006102${index}`,
          member_id: userId,
          origin: "native",
          title: "Completed synthetic session",
          started_at: `2026-11-${10 + index}T10:00:00Z`,
          finished_at: `2026-11-${10 + index}T10:45:00Z`,
          activity_date: `2026-11-${10 + index}`,
        }));
      }
      await page.goto(entry.route);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      if (entry.key === "staff-review") {
        await page
          .getByRole("region", { name: "Claim review table", exact: true })
          .getByRole("button")
          .first()
          .click();
        await expect(
          page
            .getByRole("dialog", { name: "Claim review", exact: true })
            .getByLabel("Decision reason", { exact: true }),
        ).toBeEnabled();
      }
      if (entry.key === "training-active") {
        await page.getByRole("button", { name: "Start this day", exact: true }).first().click();
        const first = page.getByRole("group", { name: "Planned set 1", exact: true });
        await first.getByLabel("kg", { exact: true }).fill("85");
        await first.getByLabel("Reps", { exact: true }).fill("10");
        await page.getByRole("button", { name: "Log set 1", exact: true }).click();
        const second = page.getByRole("group", { name: "Planned set 2", exact: true });
        await second.getByLabel("kg", { exact: true }).fill("90");
        await second.getByLabel("Reps", { exact: true }).fill("8");
      }
      if (entry.key === "training-complete") {
        await page.getByRole("button", { name: "Start this day", exact: true }).first().click();
        for (let exercise = 0; exercise < exercises.length; exercise++) {
          const card = page.locator(`[data-exercise-id="${exercises[exercise]!.id}"]`);
          if (exercise > 0) await card.locator("button[aria-expanded]").click();
          for (let number = 1; number <= (exercise < 2 ? 4 : 3); number++) {
            const group = page.getByRole("group", { name: `Planned set ${number}`, exact: true });
            await group.getByLabel("kg", { exact: true }).fill(exercise < 2 ? "80" : "25");
            await group.getByLabel("Reps", { exact: true }).fill(exercise < 2 ? "8" : "12");
            await page.getByRole("button", { name: `Log set ${number}`, exact: true }).click();
          }
        }
        await page.clock.setFixedTime(new Date("2026-11-12T10:52:00Z"));
        await page.getByRole("button", { name: "Finish workout", exact: true }).click();
        await page.getByRole("button", { name: "Save workout", exact: true }).click();
        if (stage === "after")
          await expect(page.locator("[data-workout-complete]")).toContainText("52:00");
        // Capture the same hub state in both stages. Program-origin completion
        // visibility is verified separately, without masking its navigation bug.
        await expect(
          page.getByRole("button", { name: "Start this day", exact: true }).first(),
        ).toBeVisible();
        await page.goto("/train");
        await expect(page.locator("[data-workout-complete]")).toContainText("52:00");
      }
      if (entry.key === "training-cardio") {
        const hiit = page.getByRole("region", { name: "HIIT", exact: true });
        await hiit.getByLabel("Work seconds", { exact: true }).fill("45");
        await hiit.getByLabel("Rest seconds", { exact: true }).fill("15");
        await hiit.getByLabel("Rounds", { exact: true }).fill("12");
        await hiit.getByLabel("Preparation seconds", { exact: true }).fill("0");
        await hiit.getByRole("button", { name: "Start HIIT", exact: true }).click();
        await expect(hiit.locator("[data-interval-clock]")).toContainText("0:45");
        await expect(hiit).toContainText("11:45");
      }
      if (entry.key === "training-picker") {
        await page.getByRole("button", { name: "Start workout", exact: true }).click();
        await page.getByRole("button", { name: "Add exercise", exact: true }).click();
        const picker = page.getByRole("dialog", { name: "Add exercise", exact: true });
        await picker
          .getByRole("navigation", { name: "Exercise views", exact: true })
          .getByRole("button", { name: "All", exact: true })
          .click();
        const add = picker.getByRole("button", { name: "Add", exact: true });
        await add.first().click();
        await add.first().click();
        await expect(
          picker.getByRole("button", { name: "Insert selected exercises", exact: true }),
        ).toContainText("2");
      }
      if (entry.key === "training-history") {
        await page
          .getByRole("button", { name: /^View workout details:/ })
          .first()
          .click();
        await expect(
          page.getByText("Incline Barbell Bench Press", { exact: true }).first(),
        ).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      await expect(
        page.locator('[role="status"]:visible').filter({ hasText: /^(Loading|جارٍ تحميل)/ }),
      ).toHaveCount(0);
      if (entry.key === "train")
        await expect(
          page.locator("[data-scheduled-preview] [data-session-exercises] > li"),
        ).toHaveCount(5);
      if (entry.key === "today")
        await expect(page.locator("[data-stitch-today-session] ol > li")).toHaveCount(5);
      if (entry.key === "nutrition")
        await expect(page.locator("[data-stitch-nutrition-summary]")).toContainText("1,550");
      if (entry.key === "progress-strength")
        await expect(page.locator("[data-stitch-strength-trend] svg").first()).toBeVisible();
      if (entry.key === "progress-body")
        await expect(page.locator("[data-stitch-body-metrics]")).toContainText("83");
      if (entry.key === "progress-photos") {
        await page
          .getByLabel("Before photo", { exact: true })
          .selectOption({ label: "2026-10-01" });
        await page.getByLabel("After photo", { exact: true }).selectOption({ label: "2026-11-12" });
        await expect(page.getByAltText("Before: 2026-10-01", { exact: true })).toBeVisible();
      }
      await page.evaluate(() =>
        Promise.all([...document.images].map((image) => image.decode().catch(() => {}))),
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${output}/${entry.key}.png`,
        animations: "disabled",
      });
    } finally {
      await context.close();
    }
  }
  writeFileSync(`${output}/manifest.json`, JSON.stringify(cases, null, 2));
});

for (const locale of ["en", "ar"] as const) {
  test(`training comparison layouts keep the focus header and picker controls reachable in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    await trainingFeatures(context, { guidance: true, logging: true });
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    // Enough rows to verify the list scrolls independently of the staged action.
    backend.tables.exercises!.push(
      ...Array.from({ length: 30 }, (_, index) => ({
        ...backend.tables.exercises![0],
        id: crypto.randomUUID(),
        name_en: `Synthetic exercise ${index}`,
        name_ar: `تمرين تجريبي ${index}`,
      })),
    );
    await page.goto("/train");
    await page
      .getByRole("button", { name: l("Start workout", "ابدأ التمرين"), exact: true })
      .click();
    const header = page.locator("[data-workout-focus-header]");
    await expect(header).toHaveCount(1);
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(64);
    await expect(
      header.getByRole("link", { name: l("Back to Train", "العودة إلى التدريب"), exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: l("Add exercise", "إضافة تمرين"), exact: true }).click();
    const picker = page.getByRole("dialog", {
      name: l("Add exercise", "إضافة تمرين"),
      exact: true,
    });
    await picker
      .getByRole("button", { name: l("Add", "أضف"), exact: true })
      .first()
      .click();
    const insert = picker.getByRole("button", {
      name: l("Insert selected exercises", "إدراج التمارين المحددة"),
      exact: true,
    });
    for (const [width, height] of [
      [320, 600],
      [390, 844],
      [588, 1600],
      [1280, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await expect(insert).toBeInViewport();
      const results = picker.getByRole("list", {
        name: l("Exercise results", "نتائج التمارين"),
        exact: true,
      });
      expect((await results.boundingBox())!.height).toBeGreaterThanOrEqual(80);
      await picker
        .locator("[data-exercise-picker-scroll]")
        .evaluate((node) => (node.scrollTop = node.scrollHeight));
      await expect(insert).toBeInViewport();
      await expect(insert).toContainText("1");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width + 1,
      );
    }
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    expect(backend.tables.set_logs).toHaveLength(0);
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`focused picker keeps shortlist search favorites history and offline insertion in ${locale}`, async ({
    page,
    context,
  }, testInfo) => {
    const backend = await fakeBackend(context, locale);
    backend.tables.exercises!.find((exercise) => exercise.id === secondExercise)!.name_ar =
      "سحب بالبار";
    await trainingFeatures(context, { guidance: true, logging: true });
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    const rows = Array.from({ length: 30 }, (_, index) => ({
      ...backend.tables.exercises![0],
      id: crypto.randomUUID(),
      name_en: `Synthetic exercise ${String(index).padStart(2, "0")}`,
      name_ar: `تمرين تجريبي ${String(index).padStart(2, "0")}`,
      aliases: index === 29 ? ["تمرين خاص نادر"] : [],
      muscle: "back",
      equipment: "dumbbell",
      equipment_tags: ["dumbbell"],
      active: true,
    }));
    backend.tables.exercises!.push(...rows);
    const completed = crypto.randomUUID();
    backend.tables.workout_sessions!.push({
      id: completed,
      member_id: userId,
      title: "Completed synthetic workout",
      origin: "native",
      started_at: "2026-11-11T10:00:00Z",
      finished_at: "2026-11-11T10:40:00Z",
    });
    backend.tables.set_logs!.push({
      id: crypto.randomUUID(),
      session_id: completed,
      member_id: userId,
      exercise_id: secondExercise,
      set_role: "working",
      reps: 8,
      weight_kg: 60,
      created_at: "2026-11-11T10:10:00Z",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/train");
    await page
      .getByRole("button", { name: l("Start workout", "ابدأ التمرين"), exact: true })
      .click();
    const open = () =>
      page.getByRole("button", { name: l("Add exercise", "إضافة تمرين"), exact: true }).click();
    await open();
    const picker = page.getByRole("dialog", {
      name: l("Add exercise", "إضافة تمرين"),
      exact: true,
    });
    const list = picker.getByRole("list", {
      name: l("Exercise results", "نتائج التمارين"),
      exact: true,
    });
    const views = picker.getByRole("navigation", {
      name: l("Exercise views", "طرق عرض التمارين"),
      exact: true,
    });
    const view = (en: string, ar: string) =>
      views.getByRole("button", { name: l(en, ar), exact: true }).click();
    const name = (index: number) => String(rows[index]![locale === "ar" ? "name_ar" : "name_en"]);
    await expect.poll(() => list.getByRole("listitem").count()).toBeLessThanOrEqual(8);
    await view("Recent", "الأخيرة");
    await expect(
      list.getByRole("button", { name: l("Barbell Row", "سحب بالبار"), exact: true }),
    ).toBeVisible();
    await view("All", "الكل");
    await expect(list.getByRole("listitem")).toHaveCount(12);
    await picker
      .getByRole("button", { name: /Show more exercises|عرض المزيد من التمارين/ })
      .click();
    await expect(list.getByRole("listitem")).toHaveCount(24);
    const target = list.getByRole("listitem").filter({ hasText: name(8) });
    await target
      .getByRole("button", {
        name: l("Save favorite: ", "حفظ في المفضلة: ") + name(8),
        exact: true,
      })
      .click();
    await expect(
      target.getByRole("button", {
        name: l("Remove favorite: ", "إزالة من المفضلة: ") + name(8),
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    const scroller = picker.locator("[data-exercise-picker-scroll]");
    await list.getByRole("button", { name: name(15), exact: true }).scrollIntoViewIfNeeded();
    const position = await scroller.evaluate((node) => node.scrollTop);
    await list.getByRole("button", { name: name(15), exact: true }).click();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: l("Close", "إغلاق"), exact: true })
      .click();
    await expect
      .poll(async () => Math.abs((await scroller.evaluate((node) => node.scrollTop)) - position))
      .toBeLessThanOrEqual(2);
    await view("Favorites", "المفضلة");
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await list.getByRole("button", { name: l("Add", "أضف"), exact: true }).click();
    const search = picker.getByRole("searchbox", {
      name: l("Search exercises", "ابحث عن تمرين"),
      exact: true,
    });
    await search.fill("تمرين خاص نادر");
    await expect(list.getByRole("button", { name: name(29), exact: true })).toBeVisible();
    await picker
      .getByRole("button", { name: l("Browse by muscle", "تصفح حسب العضلة"), exact: true })
      .click();
    await picker
      .getByRole("group", { name: l("Muscle", "العضلة"), exact: true })
      .getByRole("button", { name: l("Chest", "الصدر"), exact: true })
      .click();
    await expect(list.getByRole("listitem")).toHaveCount(0);
    await expect(
      picker.getByRole("status").filter({ hasText: l("filters apply", "الفلاتر مطبقة") }),
    ).toBeVisible();
    await picker
      .getByRole("button", { name: l("Reset filters", "إعادة ضبط الفلاتر"), exact: true })
      .click();
    await list.getByRole("button", { name: l("Add", "أضف"), exact: true }).click();
    await picker
      .getByRole("button", {
        name: l("Clear exercise search", "مسح البحث عن التمارين"),
        exact: true,
      })
      .click();
    const insert = picker.getByRole("button", {
      name: l("Insert selected exercises", "إدراج التمارين المحددة"),
      exact: true,
    });
    await expect(insert).toContainText("2");
    await expect(insert).toBeInViewport();
    await page.screenshot({ path: `artifacts/focused-picker-${locale}.png` });
    await insert.click();
    await expect(picker).toBeHidden();
    // The compatibility config blocks service workers; installed-shell/offline
    // recovery is verified by the production Chrome run, while WebKit checks refresh.
    if (testInfo.project.name === "mobile-chromium") {
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
      await expect
        .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20000 })
        .toBe(true);
      await context.setOffline(true);
    }
    await page.reload();
    await open();
    await view("Favorites", "المفضلة");
    await expect(list.getByRole("button", { name: name(8), exact: true })).toBeVisible();
    await view("Recent", "الأخيرة");
    await expect(list.getByRole("button", { name: name(29), exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(`[data-exercise-id="${rows[8]!.id}"]`)).toHaveCount(1);
    await expect(page.locator(`[data-exercise-id="${rows[29]!.id}"]`)).toHaveCount(1);
    expect(backend.tables.set_logs).toHaveLength(1);
  });
}

test("workspace preferences cannot expose staff navigation to a member", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "member" }];
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/today");
  await expect(page.locator("aside [data-workspace-navigation]")).toHaveAttribute(
    "data-workspace-navigation",
    "fitness",
  );
  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("pf-workspace:")) sessionStorage.setItem(key, "staff");
  });
  await page.goto("/profile");
  await expect(page.locator("[data-studio-shell]")).toHaveAttribute("data-workspace", "fitness");
  await expect(page.getByRole("button", { name: /^Workspace:/ })).toHaveCount(0);
  await expect(page.locator('aside a[href^="/admin/"]')).toHaveCount(0);
  await page.goto("/admin/members");
  await expect(page.getByRole("link", { name: "Return to My Fitness", exact: true })).toBeVisible();
  await expect(page.locator('aside a[href^="/admin/"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Return to My Fitness", exact: true }).click();
  await expect(page.locator("[data-studio-shell]")).toHaveAttribute("data-workspace", "fitness");
});

test("workspace switching respects unsaved staff review drafts", async ({ page, context }) => {
  const backend = await fakeBackend(context);
  seedPvReviews(backend);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/pv");
  await page
    .getByRole("region", { name: "Claim review table", exact: true })
    .getByRole("button")
    .first()
    .click();
  const reason = page
    .getByRole("dialog", { name: "Claim review", exact: true })
    .getByLabel("Decision reason", { exact: true });
  await reason.fill("Keep this synthetic draft while changing workspace.");
  const switchToFitness = async () => {
    await page.getByRole("button", { name: "Workspace: Staff Workspace", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "My Fitness", exact: true }).click();
  };
  // Selection follows accepted navigation, so cancelling the guard cannot change menus.
  await switchToFitness();
  const guard = page.getByRole("alertdialog", { name: "Unsaved admin drafts", exact: true });
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.locator("[data-studio-shell]")).toHaveAttribute("data-workspace", "staff");
  await expect(reason).toHaveValue("Keep this synthetic draft while changing workspace.");
  await switchToFitness();
  await guard.getByRole("button", { name: "Discard and continue", exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator("[data-studio-shell]")).toHaveAttribute("data-workspace", "fitness");
  expect(backend.tables.pv_ledger).toHaveLength(0);
});

test("coach workspace offers existing member management without admin destinations", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "coach" }];
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/today");
  await page.getByRole("button", { name: "Workspace: My Fitness", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Staff Workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/members$/);
  await expect(page.locator("aside [data-workspace-navigation]").getByRole("link")).toHaveCount(1);
  await expect(page.locator('aside a[href="/members"]')).toBeVisible();
  await expect(page.locator('aside a[href^="/admin/"]')).toHaveCount(0);
});

for (const locale of ["en", "ar"] as const) {
  test(`workspace navigation keeps its order and shared settings context in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    seedAdminPods(backend);
    seedPvReviews(backend);
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/today");
    const shell = page.locator("[data-studio-shell]");
    const side = page.locator("aside [data-workspace-navigation]");
    const hrefs = (node: Locator) =>
      node
        .getByRole("link")
        .evaluateAll((links) =>
          links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
        );
    const fitness = ["/today", "/train", "/nutrition", "/progress", "/rewards"];
    await expect.poll(() => hrefs(side)).toEqual(fitness);
    const footerY = (await page.locator("aside [data-workspace-utilities]").boundingBox())!.y;
    await side.locator('a[href="/nutrition"]').click();
    await expect.poll(() => hrefs(side)).toEqual(fitness);
    await page
      .locator("[data-app-toolbar]")
      .getByRole("link", { name: l("Profile", "الملف"), exact: true })
      .click();
    await expect(shell).toHaveAttribute("data-workspace", "fitness");
    await page
      .getByRole("button", {
        name: `${l("Workspace", "مساحة العمل")}: ${l("My Fitness", "لياقتي")}`,
        exact: true,
      })
      .click();
    await page
      .getByRole("menuitemradio", { name: l("Staff Workspace", "مساحة عمل الفريق"), exact: true })
      .click();
    await expect(page).toHaveURL(/admin\/analytics/);
    const staff = [
      "/admin/analytics",
      "/admin/members",
      "/admin/programs",
      "/admin/exercises",
      "/admin/pods",
      "/admin/pv",
      "/admin/shop",
      "/admin/invites",
      "/admin/targets",
      "/members",
    ];
    await expect.poll(() => hrefs(side)).toEqual(staff);
    await expect(side.locator('a[href="/admin/analytics"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Active text must differ from muted destinations even when utility classes collide.
    await expect
      .poll(async () => {
        const current = await side
          .locator('a[href="/admin/analytics"]')
          .evaluate((node) => getComputedStyle(node).color);
        const inactive = await side
          .locator('a[href="/admin/members"]')
          .evaluate((node) => getComputedStyle(node).color);
        return current !== inactive;
      })
      .toBe(true);
    expect(
      Math.abs((await page.locator("aside [data-workspace-utilities]").boundingBox())!.y - footerY),
    ).toBeLessThan(1);
    await side.locator('a[href="/admin/members"]').click();
    await expect.poll(() => hrefs(side)).toEqual(staff);
    await page.locator("aside [data-workspace-utilities]").getByRole("link").click();
    await expect(shell).toHaveAttribute("data-workspace", "staff");
    await page.reload();
    await expect.poll(() => hrefs(side)).toEqual(staff);
    await page.setViewportSize({ width: 390, height: 850 });
    const menu = page.getByRole("button", { name: l("Menu", "القائمة"), exact: true });
    await menu.click();
    const drawer = page.getByRole("dialog", { name: l("Menu", "القائمة"), exact: true });
    await expect.poll(() => hrefs(drawer.locator("[data-workspace-navigation]"))).toEqual(staff);
    await drawer.locator('a[href="/admin/members"]').click();
    await expect(drawer).toHaveCount(0);
    await expect
      .poll(() =>
        hrefs(
          page.getByRole("navigation", {
            name: l("Primary navigation", "التنقل الرئيسي"),
            exact: true,
          }),
        ),
      )
      .toEqual(staff.slice(0, 5));
    await menu.click();
    await page.setViewportSize({ width: 900, height: 850 });
    await expect(drawer).toHaveCount(0);
    await expect(page.locator("aside")).toHaveCSS("width", "88px");
    await expect.poll(() => hrefs(side)).toEqual(staff);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator("aside")).toHaveCSS("width", "240px");
    await page.screenshot({ path: `artifacts/workspace-staff-${locale}.png` });
  });

  test(`workout focus can return to Train and resume the same draft in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await page.goto("/train");
    await page
      .getByRole("button", { name: l("Start workout", "ابدأ التمرين"), exact: true })
      .click();
    await page.getByLabel("kg", { exact: true }).fill("60.5");
    await page.getByLabel(l("Reps", "التكرارات"), { exact: true }).fill("6");
    await page
      .getByRole("link", { name: l("Back to Train", "العودة إلى التدريب"), exact: true })
      .click();
    await expect(page.locator("[data-workout-resume]")).toBeVisible();
    await expect(page).toHaveURL(/view=overview/);
    await page.reload();
    await expect(page.locator("[data-workout-resume]")).toBeVisible();
    await page.getByRole("button", { name: l("History", "السجل"), exact: true }).click();
    await page
      .getByRole("button", {
        name: l("Filter by Workout or Date", "تصفية حسب الجلسة أو التاريخ"),
        exact: true,
      })
      .click();
    await expect(
      page.getByLabel(l("Search workout titles", "البحث في عناوين الجلسات")),
    ).toBeVisible();
    await page
      .getByRole("button", { name: l("Apply filters", "تطبيق الفلاتر"), exact: true })
      .click();
    await expect(page).toHaveURL(/view=overview/);
    await page.getByRole("button", { name: l("Workout", "تمرين"), exact: true }).click();
    await page.locator("[data-workout-resume]").getByRole("button").click();
    await expect(page.getByLabel("kg", { exact: true })).toHaveValue("60.5");
    await expect(page.getByLabel(l("Reps", "التكرارات"), { exact: true })).toHaveValue("6");
    expect(backend.tables.workout_sessions).toHaveLength(1);
    await expect(
      page.getByRole("navigation", {
        name: l("Primary navigation", "التنقل الرئيسي"),
        exact: true,
      }),
    ).toHaveCount(0);
  });

  test(`progress comparison views and phone measurements retain state in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    backend.tables.body_measurements = [
      {
        id: crypto.randomUUID(),
        member_id: userId,
        measured_on: "2026-11-12",
        weight_kg: 82,
        waist_cm: null,
        body_fat_pct: 18,
      },
      {
        id: crypto.randomUUID(),
        member_id: userId,
        measured_on: "2026-10-01",
        weight_kg: 84,
        waist_cm: 85,
        body_fat_pct: null,
      },
    ];
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto("/progress?section=photos");
    await expect(page.locator("[data-photo-side-by-side] figure")).toHaveCount(2);
    const sliderButton = page.getByRole("button", {
      name: l("Slider overlay", "شريط المقارنة"),
      exact: true,
    });
    await sliderButton.focus();
    await page.keyboard.press("Enter");
    const slider = page.getByRole("slider");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveValue("51");
    await page
      .getByRole("button", { name: l("Side by side", "جنباً إلى جنب"), exact: true })
      .click();
    await expect(page.locator("[data-photo-side-by-side] figure")).toHaveCount(2);
    await sliderButton.click();
    await expect(slider).toHaveValue("51");
    await page.getByRole("button", { name: l("Body", "الجسم"), exact: true }).click();
    const history = page.getByRole("region", {
      name: l("Measurement history", "سجل القياسات"),
      exact: true,
    });
    await expect(history.getByRole("listitem")).toHaveCount(2);
    const latest = history.getByRole("listitem").filter({ hasText: "2026-11-12" });
    await expect(latest.getByRole("definition").nth(1)).toContainText("—");
    await page
      .getByRole("button", { name: l("Add measurements", "إضافة قياسات"), exact: true })
      .click();
    await page.getByLabel(l("Weight kg", "الوزن kg"), { exact: true }).fill("81.5");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: l("Close", "إغلاق"), exact: true })
      .click();
    await page.getByRole("button", { name: l("Photos", "الصور"), exact: true }).click();
    await expect(slider).toHaveValue("51");
    await page.getByRole("button", { name: l("Body", "الجسم"), exact: true }).click();
    await page
      .getByRole("button", { name: l("Add measurements", "إضافة قياسات"), exact: true })
      .click();
    await expect(page.getByLabel(l("Weight kg", "الوزن kg"), { exact: true })).toHaveValue("81.5");
  });

  test(`daily overview layouts retain real status and narrow containment in ${locale}`, async ({
    page,
    context,
  }) => {
    await fakeBackend(context, locale);
    await trainingFeatures(context, { offline: false });
    await page.setViewportSize({ width: 313, height: 850 });
    await page.goto("/today");
    await expect(page.locator("[data-today-rank]")).toContainText(
      locale === "ar" ? "المستوى" : "Level",
    );
    for (const route of ["/today", "/nutrition", "/progress"]) {
      if (route !== "/today") await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
    const metrics = page.locator("[data-stitch-progress-metrics]");
    await expect(metrics).toContainText(locale === "ar" ? "بما فيه المستورد" : "including imports");
    await expect(metrics).toContainText(locale === "ar" ? "القاهرة" : "Cairo time");
  });

  test(`partial nutrition cache never claims a final remaining budget in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale, 14);
    await trainingFeatures(context, { offline: true });
    await page.clock.setFixedTime(new Date("2026-11-12T10:00:00Z"));
    await page.goto("/nutrition");
    const summary = page.locator("[data-stitch-nutrition-summary]");
    await expect(summary).toContainText(locale === "ar" ? "متبقية" : "remaining");
    await expect(summary.locator(".fuel-fill")).toHaveCount(4);
    await context.setOffline(true);
    // Travel forward beyond the seven-day window while keeping cached targets.
    // The public focus/date flow must expose partial records without a false budget.
    await page.clock.setFixedTime(new Date("2026-11-20T10:00:00Z"));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByLabel(locale === "ar" ? "تاريخ السجل" : "Log date", { exact: true }),
    ).toHaveValue("2026-11-20");
    await page
      .getByRole("button", { name: locale === "ar" ? "إضافة طعام" : "Add food", exact: true })
      .click();
    await page.getByLabel(locale === "ar" ? "السعرات" : "Calories", { exact: true }).fill("500");
    await page.getByRole("dialog").locator('button[type="submit"]').click();
    await expect(summary).toContainText(locale === "ar" ? "إجماليات جزئية" : "partial totals");
    await expect(summary).toContainText(
      locale === "ar" ? "المتبقي غير متاح" : "Remaining budget unavailable",
    );
    await expect(summary).not.toContainText(/%/);
    expect(backend.tables.food_logs).toHaveLength(0);
    await expect(summary.locator(".fuel-fill")).toHaveCount(0);
    await page.setViewportSize({ width: 313, height: 850 });
    // Shared selection markers remeasure on the next frame after a resize.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });

  test(`nutrition loading shows placeholders only until totals arrive in ${locale}`, async ({
    page,
    context,
  }) => {
    await fakeBackend(context, locale);
    await trainingFeatures(context, { offline: false });
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    await context.route("**/rest/v1/food_logs**", async (route) => {
      if (route.request().method() === "GET") await delayed;
      await route.fallback();
    });
    try {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/nutrition", { waitUntil: "domcontentloaded" });
      const text = locale === "ar" ? "جارٍ تحميل إجماليات التغذية…" : "Loading nutrition totals…";
      const loading = page.getByRole("status").filter({ hasText: text });
      await expect(loading).toBeVisible();
      await expect(loading.locator('[aria-hidden="true"]')).toBeVisible();
      await expect(page.locator("[data-stitch-nutrition-summary]")).toHaveCount(0);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      release();
      await expect(loading).toHaveCount(0);
      await expect(page.locator("[data-stitch-nutrition-summary]")).toBeVisible();
    } finally {
      release();
    }
  });

  test(`nutrition loading yields to an error and retry in ${locale}`, async ({ page, context }) => {
    await fakeBackend(context, locale);
    await trainingFeatures(context, { offline: false });
    let fail = true;
    await context.route("**/rest/v1/food_logs**", async (route) => {
      if (fail && route.request().method() === "GET")
        await route.fulfill({ status: 400, json: { message: "Synthetic read failure" } });
      else await route.fallback();
    });
    await page.goto("/nutrition");
    const alert = page
      .getByRole("alert")
      .filter({ hasText: locale === "ar" ? "تعذر تحديث البيانات" : "Could not refresh data" });
    await expect(alert).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("status").filter({
        hasText: locale === "ar" ? "جارٍ تحميل إجماليات التغذية" : "Loading nutrition totals",
      }),
    ).toHaveCount(0);
    fail = false;
    await alert.getByRole("button").click();
    await expect(page.locator("[data-stitch-nutrition-summary]")).toBeVisible();
  });

  test(`Profile disclosures retain password drafts and photo actions in ${locale}`, async ({
    page,
    context,
  }) => {
    await fakeBackend(context, locale);
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await page.goto("/profile");
    const password = page.getByLabel(l("New password", "كلمة المرور الجديدة"), { exact: true });
    const disclosure = page.locator("[data-profile-password] summary");
    await expect(password).not.toBeVisible();
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await password.fill("SyntheticDraftOnly1");
    await disclosure.click();
    await expect(password).not.toBeVisible();
    // A collapsed form still belongs to the unsaved-account navigation guard.
    await page
      .getByRole("navigation", { name: l("Profile sections", "أقسام الملف") })
      .getByRole("button", { name: l("App", "التطبيق"), exact: true })
      .click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page
      .getByRole("button", { name: l("Keep editing", "متابعة التعديل"), exact: true })
      .click();
    await disclosure.focus();
    await page.keyboard.press("Space");
    await expect(password).toHaveValue("SyntheticDraftOnly1");
    await page.locator("[data-profile-activity] summary").click();
    await expect(
      page.getByRole("button", { name: l("Gallery", "المعرض"), exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: l("Take photo", "التقاط صورة"), exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel(l("Take profile photo", "التقاط صورة الملف الشخصي"), { exact: true }),
    ).toHaveAttribute("capture", "user");
    await page
      .getByRole("button", {
        name: l("Review app & offline", "مراجعة التطبيق ودون اتصال"),
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: l("Discard and continue", "تجاهل ومتابعة"), exact: true })
      .click();
    await expect(page).toHaveURL(/section=offline/);
    await page.getByRole("button", { name: l("Account", "الحساب"), exact: true }).click();
    await page.locator("[data-profile-password] summary").click();
    await expect(password).toHaveValue("");
  });

  test(`staff editor Escape restores its originating keyboard action in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    seedPvReviews(backend);
    // Tablet retains the modal sheet; desktop has a separate non-modal pane test.
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/pv");
    const action = page
      .getByRole("region", {
        name: locale === "ar" ? "جدول مراجعة الطلبات" : "Claim review table",
        exact: true,
      })
      .getByRole("button")
      .first();
    await action.focus();
    await page.keyboard.press("Enter");
    const editor = page.getByRole("dialog", {
      name: locale === "ar" ? "مراجعة الطلب" : "Claim review",
      exact: true,
    });
    await expect(editor.getByRole("heading").first()).toBeFocused();
    // Traversal in both directions must remain in the modal, including wrap-around.
    for (const key of ["Tab", "Shift+Tab"])
      for (let index = 0; index < 12; index++) {
        await page.keyboard.press(key);
        await expect
          .poll(() => editor.evaluate((node) => node.contains(document.activeElement)))
          .toBe(true);
      }
    await page.keyboard.press("Escape");
    await expect(editor).toHaveCount(0);
    await expect(action).toBeFocused();
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`desktop claim pane preserves queue access and drafts across frames in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    seedPvReviews(backend);
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/admin/pv");
    const table = page.getByRole("region", {
      name: l("Claim review table", "جدول مراجعة الطلبات"),
      exact: true,
    });
    const actions = table.getByRole("button");
    const first = actions.first();
    await first.focus();
    await page.keyboard.press("Enter");
    const editor = page.getByRole("dialog", {
      name: l("Claim review", "مراجعة الطلب"),
      exact: true,
    });
    await expect(editor).toHaveAttribute("aria-modal", "false");
    await expect(editor.getByRole("heading").first()).toBeFocused();
    const queueBox = (await table.boundingBox())!,
      paneBox = (await editor.boundingBox())!;
    expect(
      locale === "ar"
        ? paneBox.x + paneBox.width <= queueBox.x
        : queueBox.x + queueBox.width <= paneBox.x,
    ).toBe(true);
    const reason = editor.getByLabel(l("Decision reason", "سبب القرار"), { exact: true });
    await reason.fill("Retain this synthetic decision across breakpoints and claims.");
    const search = page.getByRole("textbox", {
      name: l("Search claims", "بحث الطلبات"),
      exact: true,
    });
    await search.focus();
    await expect(search).toBeFocused();
    await actions.nth(1).click();
    await expect(reason).toHaveValue("");
    await expect(editor.getByRole("heading").first()).toBeFocused();
    await first.click();
    await expect(reason).toHaveValue(
      "Retain this synthetic decision across breakpoints and claims.",
    );
    // The presentation remounts at the breakpoint; controlled values and retry
    // state belong to PvClaimEditor and must survive both directions.
    await page.setViewportSize({ width: 1024, height: 850 });
    await expect(page.locator("[data-docked-review]")).toHaveCount(0);
    await expect(editor).toBeVisible();
    await expect(reason).toHaveValue(
      "Retain this synthetic decision across breakpoints and claims.",
    );
    await expect(editor.getByRole("heading").first()).toBeFocused();
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press("Tab");
      await expect
        .poll(() => editor.evaluate((node) => node.contains(document.activeElement)))
        .toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(editor).toHaveAttribute("aria-modal", "false");
    await expect(reason).toHaveValue(
      "Retain this synthetic decision across breakpoints and claims.",
    );
    await editor
      .getByRole("button", { name: l("Review decision", "مراجعة القرار"), exact: true })
      .click();
    const confirmation = page.getByRole("dialog", {
      name: l("Review PV decision", "مراجعة قرار PV"),
      exact: true,
    });
    await expect(confirmation).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirmation).toHaveCount(0);
    await expect(editor).toBeVisible();
    expect(backend.tables.pv_ledger).toHaveLength(0);
    await reason.focus();
    await page.keyboard.press("Escape");
    await expect(editor).toHaveCount(0);
    await expect(first).toBeFocused();
    await first.click();
    await expect(reason).toHaveValue(
      "Retain this synthetic decision across breakpoints and claims.",
    );
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`responsive Pod and claim editors retain keyboard access and drafts in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    seedAdminPods(backend);
    seedPvReviews(backend);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/admin/pods");
    const openRoster = page
      .getByRole("region", {
        name: locale === "ar" ? "جدول المجموعات" : "Pod directory table",
        exact: true,
      })
      .getByRole("button")
      .first();
    await expect(openRoster).toBeVisible();
    if (process.env["PW_UI_SCREENSHOTS"])
      await page.screenshot({
        path: `artifacts/phase6-pod-directory-${locale}.png`,
        animations: "disabled",
      });
    await openRoster.focus();
    await page.keyboard.press("Enter");
    const roster = page.getByRole("dialog", {
      name: locale === "ar" ? "إدارة المجموعة: Test Pod" : "Manage Pod: Test Pod",
      exact: true,
    });
    await expect(roster.getByRole("heading").first()).toBeFocused();
    const sizes = [
      [320, 740],
      [640, 360],
      [768, 1024],
      [1280, 800],
      [1920, 1080],
    ] as const;
    const contained = async (dialog: Locator) => {
      await expect
        .poll(() =>
          dialog.evaluate((node) => {
            const box = node.getBoundingClientRect();
            return (
              box.left >= -1 &&
              box.right <= innerWidth + 1 &&
              box.top >= -1 &&
              box.bottom <= innerHeight + 1 &&
              node.scrollWidth <= node.clientWidth + 1
            );
          }),
        )
        .toBe(true);
    };
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await contained(roster);
    }
    await page.keyboard.press("Escape");
    await expect(roster).toHaveCount(0);
    await page.goto("/admin/pv");
    const table = page.getByRole("region", {
      name: locale === "ar" ? "جدول مراجعة الطلبات" : "Claim review table",
      exact: true,
    });
    const openClaim = table.getByRole("button").first();
    await expect(openClaim).toBeVisible();
    if (process.env["PW_UI_SCREENSHOTS"])
      await page.screenshot({
        path: `artifacts/phase6-claim-queue-${locale}.png`,
        animations: "disabled",
      });
    await openClaim.focus();
    await page.keyboard.press("Enter");
    const review = page.getByRole("dialog", {
      name: locale === "ar" ? "مراجعة الطلب" : "Claim review",
      exact: true,
    });
    await expect(review.getByRole("heading").first()).toBeFocused();
    const reason = review.getByRole("textbox", {
      name: locale === "ar" ? "سبب القرار" : "Decision reason",
      exact: true,
    });
    await reason.fill("Retain this review draft while resizing.");
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await contained(review);
      await expect(reason).toHaveValue("Retain this review draft while resizing.");
      if (process.env["PW_UI_SCREENSHOTS"] && width === 640)
        await review.screenshot({
          path: `artifacts/phase6-claim-landscape-${locale}.png`,
          animations: "disabled",
        });
    }
    await page.keyboard.press("Escape");
    await expect(review).toHaveCount(0);
    await openClaim.click();
    await expect(reason).toHaveValue("Retain this review draft while resizing.");
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`responsive member and staff route matrix contains content in ${locale}`, async ({
    page,
    context,
  }, testInfo) => {
    testInfo.setTimeout(180000);
    const backend = await fakeBackend(context, locale);
    seedAdminPods(backend);
    seedPvReviews(backend);
    await trainingFeatures(context, { guidance: true, cardio: true, social: true, offline: true });
    await context.route("**/rest/v1/rpc/get_cardio_history", (route) =>
      route.fulfill({ json: [] }),
    );
    backend.tables.pods![0]!.name = "Prime Vanguard " + "Squad".repeat(25);
    backend.tables.pv_tasks![0]!.title_en = "Training assessment " + "Evidence".repeat(22);
    backend.tables.pv_tasks![0]!.title_ar = "مراجعة التدريب " + "متابعة".repeat(22);
    const analyticsRows = backend.tables.profiles!.map((row) => ({
      ...row,
      xp: 100,
      pv: 25,
      w7: 2,
      w30: 4,
    }));
    await context.route("**/rest/v1/rpc/get_admin_analytics", (route) =>
      route.fulfill({
        json: {
          asOf: "2026-11-11T10:00:00Z",
          period: { from7: "2026-11-05", from30: "2026-10-13", to: "2026-11-11" },
          kpi: {
            members: analyticsRows.length,
            activeMembers: analyticsRows.length,
            engaged7: analyticsRows.length,
            workouts7: analyticsRows.length * 2,
            workouts30: analyticsRows.length * 4,
            pvIssued: 200,
            pendingClaims: 3,
            pendingRedemptions: 0,
          },
          rows: analyticsRows,
        },
      }),
    );
    const routes = [
      "/today",
      "/train",
      "/train?section=program",
      "/train?section=history",
      "/train?section=cardio",
      "/nutrition",
      "/progress",
      "/progress?section=strength",
      "/progress?section=body",
      "/progress?section=photos",
      "/rewards",
      "/rewards?section=shop",
      "/rewards?section=journey",
      "/rewards?section=community",
      "/profile",
      "/profile?section=preferences",
      "/profile?section=offline",
      "/profile?section=privacy",
      "/members",
      "/admin/members",
      "/admin/programs",
      "/admin/exercises",
      "/admin/pods",
      "/admin/pv",
      "/admin/pv?section=tasks",
      "/admin/shop",
      "/admin/shop?section=catalogue",
      "/admin/invites",
      "/admin/targets",
      "/admin/analytics",
    ];
    const sizes = [
      [320, 740],
      [390, 844],
      [640, 480],
      [768, 1024],
      [820, 1180],
      [1024, 768],
      [1280, 800],
      [1920, 1080],
    ] as const;
    const evidence: { route: string; width: number; height: number; documentWidth: number }[] = [];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(
        page.locator('[role="status"]:visible').filter({ hasText: /^(Loading|جارٍ تحميل)/ }),
      ).toHaveCount(0);
      // Ensure long-content fixtures arrived before measuring their smallest layout.
      if (route === "/admin/pods")
        await expect(
          page.getByRole("cell", { name: String(backend.tables.pods![0]!.name), exact: true }),
        ).toBeVisible();
      if (route === "/admin/pv")
        await expect(
          page
            .getByRole("cell", {
              name: String(backend.tables.pv_tasks![0]![locale === "ar" ? "title_ar" : "title_en"]),
              exact: true,
            })
            .first(),
        ).toBeVisible();
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
            message: `${locale} ${route} at ${width}x${height}`,
          })
          .toBeLessThanOrEqual(width + 1);
        evidence.push({
          route,
          width,
          height,
          documentWidth: await page.evaluate(() => document.documentElement.scrollWidth),
        });
        if (
          process.env["PW_UI_SCREENSHOTS"] &&
          width === 1280 &&
          ["/admin/pods", "/admin/pv", "/nutrition"].includes(route)
        )
          await page.screenshot({
            path: `artifacts/phase6-responsive-${route.split("/").filter(Boolean).join("-")}-${locale}.png`,
            animations: "disabled",
          });
      }
    }
    // Store only viewport/route evidence, never member records or screenshots of real accounts.
    const engine = testInfo.project.name === "mobile-chromium" ? "" : `-${testInfo.project.name}`;
    writeFileSync(
      `artifacts/phase6-responsive-${locale}${engine}.json`,
      JSON.stringify(evidence, null, 2),
    );
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`progress loading placeholder resolves to real metrics in ${locale}`, async ({
    page,
    context,
  }) => {
    await fakeBackend(context, locale);
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    await context.route("**/rest/v1/workout_sessions**", async (route) => {
      if (route.request().method() === "HEAD") await delayed;
      await route.fallback();
    });
    try {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/progress", { waitUntil: "domcontentloaded" });
      const message = locale === "ar" ? "جارٍ تحميل الملخص…" : "Loading progress summary…";
      const loading = page.getByRole("status").filter({ hasText: message });
      await expect(loading).toBeVisible();
      await expect(loading.locator('[aria-hidden="true"] > div')).toHaveCount(3);
      await expect(page.locator("[data-stitch-progress-metrics]")).toHaveCount(0);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      release();
      await expect(loading).toHaveCount(0);
      await expect(page.locator("[data-stitch-progress-metrics]")).toBeVisible();
    } finally {
      release();
    }
  });

  test(`shared switcher motion follows resize, scrolling and keyboard selection in ${locale}`, async ({
    page,
    context,
  }) => {
    await fakeBackend(context, locale);
    await trainingFeatures(context, { guidance: true });
    const aligned = async (group: Locator, selected: Locator) => {
      const indicator = group.locator(":scope > [data-section-slider]");
      await expect(indicator).toHaveAttribute("data-ready", "true");
      await expect
        .poll(async () => {
          const a = await indicator.boundingBox(),
            b = await selected.boundingBox();
          if (!a || !b) return Infinity;
          return Math.max(
            Math.abs(a.x - b.x),
            Math.abs(a.y - b.y),
            Math.abs(a.width - b.width),
            Math.abs(a.height - b.height),
          );
        })
        .toBeLessThanOrEqual(1);
    };
    await page.goto("/profile");
    const profile = page.getByRole("navigation", {
      name: locale === "ar" ? "أقسام الملف" : "Profile sections",
      exact: true,
    });
    const privacy = profile.getByRole("button").last();
    await privacy.click();
    for (const width of [320, 1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await aligned(profile, privacy);
    }
    // CSS text zoom is not native browser zoom, but catches layout-vs-screen pixel mistakes.
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const zoom of [1.5, 2]) {
      await profile.evaluate((node, value) => {
        node.style.zoom = String(value);
      }, zoom);
      await privacy.click();
      await aligned(profile, privacy);
      await profile.getByRole("button").first().click();
      await aligned(profile, profile.getByRole("button").first());
    }
    await profile.evaluate((node) => {
      node.style.zoom = "1";
    });
    await profile.getByRole("button").nth(2).click();
    const sound = page.getByRole("switch", {
      name: locale === "ar" ? "صوت تسجيل الماء" : "Water logging sound",
      exact: true,
    });
    await sound.focus();
    await page.keyboard.press("Space");
    await expect(sound).toHaveAttribute("aria-checked", "true");
    // The checked thumb must remain inside its track in both layout directions.
    await expect
      .poll(async () => {
        const track = (await sound.boundingBox())!,
          thumb = (await sound.locator(":scope > span").boundingBox())!;
        return thumb.x >= track.x && thumb.x + thumb.width <= track.x + track.width;
      })
      .toBe(true);
    await page.goto("/nutrition?entry=quick&meal=lunch");
    const methods = page.getByRole("navigation", {
      name: locale === "ar" ? "طرق إضافة الطعام" : "Food entry methods",
      exact: true,
    });
    const method = methods.getByRole("button").last();
    await method.focus();
    await page.keyboard.press("Enter");
    await expect(method).toHaveAttribute("aria-pressed", "true");
    await aligned(methods, method);
    // Scroll the strip without changing the selected method or shifting its indicator.
    await methods.evaluate((node) => {
      node.scrollLeft = 0;
    });
    await aligned(methods, method);
    const meals = page.getByRole("navigation", {
      name: locale === "ar" ? "اختيار الوجبة" : "Choose meal",
      exact: true,
    });
    const meal = meals.getByRole("button").last();
    await meal.click();
    await aligned(meals, meal);
    await page.goto("/train");
    await page
      .getByRole("button", {
        name: locale === "ar" ? "ابدأ التمرين" : "Start workout",
        exact: true,
      })
      .click();
    const tabs = page.getByRole("tablist", {
      name: locale === "ar" ? "تفاصيل التمرين" : "Exercise details",
      exact: true,
    });
    const first = tabs.getByRole("tab").first(),
      last = tabs.getByRole("tab").last();
    await first.focus();
    await page.keyboard.press("End");
    await expect(last).toBeFocused();
    await expect(last).toHaveAttribute("aria-selected", "true");
    await aligned(tabs, last);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.keyboard.press("Home");
    await expect(first).toBeFocused();
    await aligned(tabs, first);
    await expect(tabs.locator("[data-section-slider]")).toHaveCSS("transition-property", "none");
    if (process.env["PW_UI_SCREENSHOTS"])
      await tabs.screenshot({
        path: `artifacts/switcher-tabs-${locale}.png`,
        animations: "disabled",
      });
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`pod leader mobile summaries keep private details closed in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    const pod = crypto.randomUUID();
    backend.tables.user_roles = [{ user_id: userId, role: "pod_leader" }];
    backend.tables.profiles!.push({
      ...backend.tables.profiles![0],
      id: secondExercise,
      display_name: "Pod athlete",
      email: "pod@test.invalid",
    });
    backend.tables.pods = [{ id: pod, leader_id: userId, name: "Test Pod" }];
    backend.tables.pod_members = [{ pod_id: pod, member_id: secondExercise }];
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto("/members");
    const cards = page.getByRole("list", {
      name: locale === "ar" ? "ملخصات الأعضاء المرتبطين" : "Assigned member summaries",
      exact: true,
    });
    await expect(cards).toContainText("Pod athlete");
    await expect(cards.getByRole("link")).toHaveCount(0);
    await expect(cards).toContainText(locale === "ar" ? "ملخص المجموعة فقط" : "Pod summary only");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `artifacts/phase6-pod-summary-${locale}.png`,
      animations: "disabled",
    });
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`staff roster separates overview and reviewed editor in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
    backend.tables.profiles!.push({
      ...backend.tables.profiles![0],
      id: secondExercise,
      display_name: "Managed member",
      email: "managed@test.invalid",
    });
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto("/admin/members");
    const table = page.getByRole("table", {
      name: locale === "ar" ? "قائمة الأعضاء" : "Member roster",
    });
    await expect(table).toBeVisible();
    await expect(table.getByRole("combobox")).toHaveCount(0);
    const button = table.getByRole("button", { name: /Managed member/ });
    await button.click();
    const editor = page.getByRole("dialog", {
      name: locale === "ar" ? "إدارة العضو" : "Manage member",
      exact: true,
    });
    await expect(editor.getByRole("combobox")).toBeVisible();
    await editor.getByRole("button", { name: locale === "ar" ? /^الوصول:/ : /^Access:/ }).click();
    const review = page.getByRole("dialog", {
      name: locale === "ar" ? "مراجعة تغييرات العضو" : "Review member changes",
      exact: true,
    });
    await expect(review).toBeVisible();
    expect(backend.tables.profiles![1]!.access_active).toBe(true);
    await review
      .getByRole("button", {
        name: locale === "ar" ? "متابعة التعديل" : "Keep editing",
        exact: true,
      })
      .click();
    await expect(editor).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(editor).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 850 });
    await expect(table).toBeHidden();
    await page
      .getByRole("listitem")
      .filter({ hasText: "Managed member" })
      .getByRole("button")
      .click();
    await expect(editor).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // Capture the settled drawer, rather than a frame during its entrance transition.
    await expect
      .poll(() => editor.evaluate((node) => Math.abs(node.getBoundingClientRect().left) < 1))
      .toBe(true);
    await page.screenshot({
      path: `artifacts/phase6-member-editor-${locale}.png`,
      animations: "disabled",
    });
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`Phase 5 profile and fallback stay readable in ${locale}`, async ({ page, context }) => {
    await fakeBackend(context, locale);
    await page.goto("/profile");
    await expect(
      page.getByRole("region", { name: locale === "ar" ? "بيانات الحساب" : "Account credentials" }),
    ).toBeVisible();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.setViewportSize({ width: 390, height: 850 });
    await page.screenshot({ path: `artifacts/phase5-profile-${locale}.png`, fullPage: true });
    await page
      .getByRole("button", {
        name: locale === "ar" ? /^اللغة والوحدات والراحة/ : /^Language, units & rest/,
      })
      .click();
    await expect(page).toHaveURL(/section=preferences/);
    await page.goto("/this-page-does-not-exist");
    await expect(
      page.getByRole("heading", {
        name: locale === "ar" ? "الصفحة غير موجودة" : "Page not found",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: locale === "ar" ? "الصفحة الرئيسية" : "Go home",
        exact: true,
      }),
    ).toBeVisible();
  });
}

const userId = "00000000-0000-4000-8000-000000000001";
const exerciseId = "00000000-0000-4000-8000-000000000002";
const secondExercise = "00000000-0000-4000-8000-000000000003";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "athlete@test.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
type Row = Record<string, unknown>;
function postgrestLogic(row: Row, expression: string): boolean {
  const split = (value: string) => {
    let depth = 0,
      start = 0;
    const parts: string[] = [];
    for (let i = 0; i < value.length; i++) {
      if (value[i] === "(") depth++;
      if (value[i] === ")") depth--;
      if (value[i] === "," && !depth) {
        parts.push(value.slice(start, i));
        start = i + 1;
      }
    }
    return [...parts, value.slice(start)];
  };
  if (expression.startsWith("("))
    return split(expression.slice(1, -1)).some((part) => postgrestLogic(row, part));
  if (expression.startsWith("and("))
    return split(expression.slice(4, -1)).every((part) => postgrestLogic(row, part));
  const match = expression.match(/^(\w+)\.(is|gte|lte|lt)\.(.*)$/);
  if (!match) throw new Error(`Unsupported test filter: ${expression}`);
  const [, key, op, value] = match,
    actual = row[key!];
  if (op === "is") return value === "null" && actual == null;
  if (actual == null) return false;
  return op === "gte"
    ? String(actual) >= value!
    : op === "lte"
      ? String(actual) <= value!
      : String(actual) < value!;
}
async function fakeBackend(context: BrowserContext, locale: "en" | "ar" = "en", authDays = 1) {
  const tables: Record<string, Row[]> = {
    profiles: [
      {
        ...user,
        display_name: "Test Athlete",
        access_active: true,
        onboarding_completed: true,
        locale,
        leaderboard_opt_in: true,
        pod_feed_opt_in: false,
        units: "metric",
        avatar_url: null,
      },
    ],
    user_roles: [{ role: "member" }],
    exercises: [
      {
        id: exerciseId,
        name_en: "Bench Press",
        name_ar: null,
        muscle: "chest",
        equipment: "barbell",
        active: true,
      },
      {
        id: secondExercise,
        name_en: "Barbell Row",
        name_ar: null,
        muscle: "back",
        equipment: "barbell",
        active: true,
      },
    ],
    level_thresholds: Array.from({ length: 100 }, (_, i) => ({
      level: i + 1,
      xp_required: Math.round(10000 * (i / 99) ** 1.8) * 100,
      provisional: false,
    })),
    xp_rules: [
      {
        policy_version: "million-xp-v1",
        level_100_xp: 1000000,
        workout_xp: 3500,
        workout_weekly_cap: 5,
        nutrition_day_xp: 650,
        body_week_xp: 600,
        offline_grace_days: 7,
      },
    ],
    member_xp_totals: [{ member_id: userId, xp: 300 }],
    workout_sessions: [],
    set_logs: [],
    saved_meals: [],
    food_logs: [],
    water_logs: [],
    nutrition_targets: [
      {
        member_id: userId,
        updated_at: "2026-10-29T00:00:00Z",
        calories: 2200,
        protein_g: 150,
        carbs_g: 250,
        fat_g: 70,
        water_ml: 2500,
      },
    ],
    pods: [{ id: "pod", name: "Test Pod" }],
    pod_leaderboard: [{ member_id: userId, xp: 50, display_name: "Test Athlete" }],
    pod_activity: [
      {
        id: 1,
        display_name: "Coach Tarek",
        member_id: "coach",
        pod_id: "pod",
        title: "Leg Day",
        xp: 50,
        created_at: new Date().toISOString(),
      },
    ],
    progress_photos: [
      {
        id: "photo1",
        member_id: userId,
        pose: "front",
        taken_on: "2026-08-01",
        created_at: "2026-08-01T12:00:00Z",
        path: "before.png",
      },
      {
        id: "photo2",
        member_id: userId,
        pose: "front",
        taken_on: "2026-10-01",
        created_at: "2026-10-01T12:00:00Z",
        path: "after.png",
      },
    ],
  };
  const mutationReceipts = new Map<string, Row>();
  tables.exercises = tables.exercises!.map((row) => ({
    aliases: [],
    equipment_tags: [],
    movement_pattern: null,
    logging_mode: "weighted_reps",
    load_convention: "external_total",
    guidance: {},
    media: null,
    editorial_status: "needs_review",
    instructions: null,
    media_url: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    created_by: userId,
    ...row,
  }));
  const mutationTombstones = new Map<string, number>();
  const importFingerprints = new Set<string>();
  const importChunks = new Map<string, { batch: string; accepted: number; skipped: number }>();
  const url = readFileSync(".env", "utf8").match(/^VITE_SUPABASE_URL=["']?([^\r\n"']+)/m)?.[1];
  if (!url)
    throw new Error("A public Supabase URL is needed to locate the browser auth storage key.");
  const ref = new URL(url).hostname.split(".")[0];
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      // Clock-travel cases opt in to a longer synthetic session. Production auth
      // and the default fixture lifetime remain unchanged.
      exp: Math.floor(Date.now() / 1000) + authDays * 86400,
    }),
  ).toString("base64url");
  await context.addInitScript(
    ({ key, value, locale }) => {
      localStorage.setItem("pf-locale", locale);
      localStorage.setItem(key, value);
    },
    {
      key: `sb-${ref}-auth-token`,
      locale,
      value: JSON.stringify({
        access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`,
        refresh_token: "test",
        expires_in: authDays * 86400,
        expires_at: Math.floor(Date.now() / 1000) + authDays * 86400,
        token_type: "bearer",
        user,
      }),
    },
  );
  await context.route("**/auth/v1/**", async (route) => {
    await route.fulfill({ json: user });
  });
  await context.route("**/storage/v1/**", async (route) => {
    if (
      route.request().method() === "GET" &&
      route.request().url().includes("/object/public/test/")
    )
      return route.fulfill({
        contentType: "image/gif",
        body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
      });
    if (route.request().method() === "POST" && route.request().url().includes("/object/sign/")) {
      const { paths } = route.request().postDataJSON();
      if (Array.isArray(paths))
        return route.fulfill({
          json: paths.map((path) => ({
            path,
            signedURL: `/object/public/test/${encodeURIComponent(String(path))}`,
          })),
        });
    }
    await route.fulfill({
      json: [
        { path: "before.png", signedURL: "/object/public/test/before.png" },
        { path: "after.png", signedURL: "/object/public/test/after.png" },
      ],
    });
  });
  let loseNextSetResponse = false;
  let loseNextFoodResponse = false;
  let loseNextWaterResponse = false;
  let loseNextBodyResponse = false;
  let loseImportAfter = 0;
  let setPosts = 0;
  await context.route("**/rest/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const table = url.pathname.split("/").pop()!;
    if (table === "my_weekly_quests") return route.fulfill({ json: tables.my_weekly_quests ?? [] });
    if (table === "get_training_features")
      return route.fulfill({
        json: {
          guidance: false,
          logging: false,
          progression: false,
          scheduling: false,
          imports: false,
          offline: false,
          food_scanning: false,
          cardio: false,
          social: false,
        },
      });
    if (table === "export_personal_data") {
      const own = Object.fromEntries(
        [
          "workout_sessions",
          "set_logs",
          "food_logs",
          "water_logs",
          "body_measurements",
          "saved_meals",
          "progress_photos",
        ].map((t) => [t, tables[t] ?? []]),
      );
      return void (await route.fulfill({
        json: { ...own, profile: tables.profiles![0], xp_events: [], user_roles: [] },
      }));
    }
    if (table === "apply_member_mutations") {
      const mutations = request.postDataJSON()._mutations as Row[];
      const conflicts: Row[] = [];
      for (const m of mutations) {
        if (mutationReceipts.has(String(m.id))) continue;
        const rows = tables[String(m.entity)] ?? [];
        const old = rows.find((r) => r.id === m.record_id);
        if (
          Number(old?.revision ?? mutationTombstones.get(`${m.entity}:${m.record_id}`) ?? 0) !==
          Number(m.base_revision)
        )
          conflicts.push({
            id: m.id,
            status: "conflict",
            record: old ?? null,
            revision: old?.revision ?? mutationTombstones.get(`${m.entity}:${m.record_id}`) ?? 0,
          });
      }
      if (conflicts.length) return void (await route.fulfill({ json: conflicts }));
      const result = mutations.map((m) => {
        const cached = mutationReceipts.get(String(m.id));
        if (cached) return { ...cached, status: "already_applied" };
        const rows = tables[String(m.entity)] ?? (tables[String(m.entity)] = []);
        const index = rows.findIndex((r) => r.id === m.record_id);
        const record = {
          ...(m.payload as Row),
          id: m.record_id,
          member_id: userId,
          revision: Number(m.base_revision) + 1,
          created_at: new Date().toISOString(),
        };
        if (index >= 0) rows.splice(index, 1);
        if (m.op !== "delete") rows.push(record);
        else mutationTombstones.set(`${m.entity}:${m.record_id}`, record.revision);
        const receipt = {
          id: m.id,
          status: "applied",
          record: m.op === "delete" ? null : record,
          revision: record.revision,
        };
        mutationReceipts.set(String(m.id), receipt);
        return receipt;
      });
      return void (await route.fulfill({ json: result }));
    }
    if (table === "get_import_batch_outcome") {
      const body = request.postDataJSON(),
        chunks = [...importChunks.values()].filter((r) => r.batch === body._batch);
      return void (await route.fulfill({
        json: {
          accepted: chunks.reduce((n, c) => n + c.accepted, 0),
          skipped: chunks.reduce((n, c) => n + c.skipped, 0),
          chunks: chunks.length,
        },
      }));
    }
    if (table === "commit_training_import") {
      const body = request.postDataJSON();
      const chunkKey = JSON.stringify([body._batch, body._workouts]);
      if (importChunks.has(chunkKey))
        return void (await route.fulfill({ json: importChunks.get(chunkKey) }));
      const batches = tables.import_batches ?? (tables.import_batches = []);
      if (!batches.some((b) => b.id === body._batch))
        batches.push({
          id: body._batch,
          member_id: userId,
          provider: body._provider,
          created_at: new Date().toISOString(),
        });
      let accepted = 0,
        skipped = 0;
      for (const w of body._workouts as Row[]) {
        const key = JSON.stringify(w.source_rows);
        if (importFingerprints.has(key)) {
          skipped++;
          continue;
        }
        importFingerprints.add(key);
        const id = crypto.randomUUID();
        tables.workout_sessions!.push({
          id,
          member_id: userId,
          title: w.title,
          started_at: w.started_at ?? `${w.activity_date}T00:00:00Z`,
          finished_at: w.finished_at ?? `${w.activity_date}T00:00:00Z`,
          origin: "import",
          activity_date: w.activity_date,
          import_batch_id: body._batch,
        });
        tables.set_logs!.push(
          ...(w.sets as Row[]).map((s) => ({ ...s, session_id: id, member_id: userId })),
        );
        accepted++;
      }
      importChunks.set(chunkKey, { batch: body._batch, accepted, skipped });
      if (loseImportAfter > 0 && --loseImportAfter === 0)
        return void (await route.abort("connectionfailed"));
      return void (await route.fulfill({ json: { accepted, skipped, batch_id: body._batch } }));
    }
    if (table === "restore_personal_data") {
      const data = request.postDataJSON()._data as Record<string, Row[]>;
      for (const t of [
        "workout_sessions",
        "set_logs",
        "food_logs",
        "water_logs",
        "body_measurements",
        "saved_meals",
        "progress_photos",
      ]) {
        const existing = tables[t] ?? (tables[t] = []);
        for (const row of data[t] ?? [])
          if (!existing.some((r) => r.id === row.id)) existing.push(row);
      }
      return void (await route.fulfill({ json: { inserted: {} } }));
    }
    const source = tables[table] ?? (tables[table] = []);
    const filter = (row: Row) =>
      [...url.searchParams].every(([key, value]) => {
        if (table === "set_logs" && key === "workout_sessions.finished_at")
          return tables.workout_sessions!.find((s) => s.id === row.session_id)?.finished_at != null;
        if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) return true;
        if (key === "or") return postgrestLogic(row, value);
        if (value.startsWith("ilike.")) {
          const pattern = value.slice(6),
            escape = (char: string) => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          let expression = "^";
          for (let i = 0; i < pattern.length; i++) {
            const char = pattern[i]!;
            if (char === "\\" && i + 1 < pattern.length) expression += escape(pattern[++i]!);
            else
              expression += char === "%" || char === "*" ? ".*" : char === "_" ? "." : escape(char);
          }
          return new RegExp(expression + "$", "isu").test(String(row[key] ?? ""));
        }
        if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
        if (value.startsWith("neq.")) return String(row[key]) !== value.slice(4);
        if (value === "is.null") return row[key] == null;
        if (value === "not.is.null") return row[key] != null;
        // Numbers compare as numbers; dates and text compare as strings.
        const cmp = (v: string) =>
          typeof row[key] === "number"
            ? (row[key] as number) - Number(v)
            : String(row[key]) < v
              ? -1
              : String(row[key]) > v
                ? 1
                : 0;
        if (value.startsWith("gte.")) return cmp(value.slice(4)) >= 0;
        if (value.startsWith("gt.")) return cmp(value.slice(3)) > 0;
        if (value.startsWith("lte.")) return cmp(value.slice(4)) <= 0;
        if (value.startsWith("in.("))
          return value
            .slice(4, -1)
            .split(",")
            .map((v) => v.replace(/^"|"$/g, ""))
            .includes(String(row[key]));
        return true;
      });
    let result: Row[] = source.filter(filter);
    // Mirror the "leaderboard read" RLS policy: opted-in rows plus the member's own.
    if (table === "leaderboard_weekly")
      result = result.filter((row) => row.opted_in || row.member_id === userId);
    if (request.method() === "POST") {
      const body = request.postDataJSON() as Row | Row[];
      const incoming = Array.isArray(body) ? body : [body];
      if (
        ["food_logs", "water_logs", "body_measurements"].includes(table) &&
        incoming.some((row) => row.id && source.some((old) => old.id === row.id)) &&
        !request.headers()["prefer"]?.includes("resolution=merge-duplicates")
      )
        return void (await route.fulfill({
          status: 409,
          json: { code: "23505", message: "Duplicate entry" },
        }));
      result = incoming.map((row) => {
        if (table === "nutrition_targets") {
          const old = source.find((value) => value.member_id === row.member_id);
          if (old) {
            Object.assign(old, row);
            return old;
          }
        }
        const found =
          table === "photo_deletion_queue"
            ? source.find((x) => x.photo_id === row.photo_id)
            : row.id && source.find((x) => x.id === row.id);
        if (found) {
          if (request.headers()["prefer"]?.includes("resolution=merge-duplicates"))
            Object.assign(found, row);
          return found;
        }
        const value: Row = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...row,
        };
        if (table === "invites")
          Object.assign(value, {
            accepted_at: null,
            revoked_at: null,
            coach_id: null,
            pod_id: null,
            expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
            ...row,
          });
        if (table === "pv_tasks")
          Object.assign(value, { active: true, description: null, title_ar: null, ...row });
        if (table === "rewards")
          Object.assign(value, {
            active: true,
            description: null,
            title_ar: null,
            stock: null,
            updated_at: value.created_at,
            ...row,
          });
        if (table === "programs") Object.assign(value, { updated_at: value.created_at, ...row });
        if (table === "exercises")
          Object.assign(value, {
            active: true,
            aliases: [],
            equipment_tags: [],
            movement_pattern: null,
            logging_mode: "weighted_reps",
            load_convention: "external_total",
            guidance: {},
            media: null,
            editorial_status: "needs_review",
            updated_at: value.created_at,
            instructions: null,
            media_url: null,
            ...row,
          });
        if (
          ["food_logs", "water_logs", "training_policies"].includes(table) &&
          value["revision"] == null
        )
          value["revision"] = 1;
        source.push(value);
        return value;
      });
      if (table === "food_logs" && loseNextFoodResponse) {
        loseNextFoodResponse = false;
        return void (await route.abort("connectionfailed"));
      }
      if (table === "water_logs" && loseNextWaterResponse) {
        loseNextWaterResponse = false;
        return void (await route.abort("connectionfailed"));
      }
      if (table === "body_measurements" && loseNextBodyResponse) {
        loseNextBodyResponse = false;
        return void (await route.abort("connectionfailed"));
      }
      if (table === "set_logs") {
        setPosts++;
        if (loseNextSetResponse) {
          loseNextSetResponse = false;
          return void (await route.abort("connectionfailed"));
        }
      }
    } else if (request.method() === "PATCH") {
      if (
        table === "pv_claims" &&
        result.some(
          (r) => r.member_id === userId || r.status === "approved" || r.status === "rejected",
        )
      )
        return void (await route.fulfill({
          status: 403,
          json: { message: "Claim cannot be reviewed" },
        }));
      result.forEach((row) => {
        Object.assign(row, request.postDataJSON());
        if (table === "exercises" || table === "programs" || table === "rewards")
          row.updated_at = new Date().toISOString();
        if (table === "redemptions") {
          row.reviewed_by = userId;
          row.reviewed_at = new Date().toISOString();
          if (row.status === "rejected") {
            const ledger = tables.pv_ledger ?? (tables.pv_ledger = []);
            if (!ledger.some((r) => r.redemption_id === row.id && r.source === "refund")) {
              ledger.push({
                id: crypto.randomUUID(),
                member_id: row.member_id,
                redemption_id: row.id,
                source: "refund",
                points: row.cost_pv,
              });
              const reward = tables.rewards?.find((r) => r.id === row.reward_id);
              if (reward && reward.stock !== null) reward.stock = Number(reward.stock) + 1;
            }
          }
        }
        if (table === "pv_claims") {
          row.reviewed_by = userId;
          row.reviewed_at = new Date().toISOString();
          if (row.status === "approved") {
            const ledger = tables.pv_ledger ?? (tables.pv_ledger = []);
            if (!ledger.some((r) => r.claim_id === row.id))
              ledger.push({
                claim_id: row.id,
                member_id: row.member_id,
                points: tables.pv_tasks?.find((t) => t.id === row.task_id)?.points,
              });
          }
        }
        if (["food_logs", "water_logs", "training_policies"].includes(table))
          row.revision = Number(row.revision ?? 0) + 1;
      });
    } else if (request.method() === "DELETE") {
      if (table === "progress_photos") {
        const removed = new Set(result.map((row) => row.id));
        tables.photo_deletion_queue = (tables.photo_deletion_queue ?? []).filter(
          (row) => !removed.has(row.photo_id),
        );
      }
      tables[table] = source.filter((row) => !filter(row));
      if (!request.headers()["prefer"]?.includes("return=representation")) result = [];
    }
    if (
      table === "pv_claims" &&
      request.method() === "GET" &&
      url.searchParams.get("select")?.includes("pv_tasks(")
    )
      result = result.map((row) => ({
        ...row,
        pv_tasks: tables.pv_tasks?.find((task) => task.id === row.task_id) ?? null,
      }));
    if (
      table === "member_badges" &&
      request.method() === "GET" &&
      url.searchParams.get("select")?.includes("badges(")
    )
      result = result.map((row) => ({
        ...row,
        badges: tables.badges?.find((badge) => badge.code === row.badge_code) ?? null,
      }));
    if (
      table === "set_logs" &&
      request.method() === "GET" &&
      url.searchParams.get("select")?.includes("workout_sessions")
    )
      result = result.map((row) => ({
        ...row,
        workout_sessions: tables.workout_sessions!.find((s) => s.id === row.session_id) ?? null,
      }));
    if (table === "set_logs" && request.method() === "GET")
      result = result.map((row) => ({
        ...row,
        ...(url.searchParams.get("select")?.includes("workout_exercises")
          ? {
              workout_exercises:
                tables.workout_exercises?.find((slot) => slot.id === row.workout_exercise_id) ??
                null,
            }
          : {}),
        ...(url.searchParams.get("select")?.includes("exercises(")
          ? {
              exercises:
                tables.exercises?.find((exercise) => exercise.id === row.exercise_id) ?? null,
            }
          : {}),
      }));
    if (table === "workout_sessions")
      result = result.map((row) => ({
        ...row,
        set_logs: url.searchParams.get("select")?.includes("set_logs(reps")
          ? tables
              .set_logs!.filter((s) => s.session_id === row.id)
              .map((s) => ({
                ...s,
                exercises: tables.exercises!.find((e) => e.id === s.exercise_id),
                workout_exercises: tables.workout_exercises?.find(
                  (e) => e.id === s.workout_exercise_id,
                ),
              }))
          : [{ count: tables.set_logs!.filter((s) => s.session_id === row.id).length }],
      }));
    if (request.method() === "GET") {
      // Apply PostgREST order=col.desc,col2.asc before the limit, like the real API (stable sort).
      // ponytail: leaderboard only; other fixtures still rely on insertion order. Widen when they are fixed.
      const order = (url.searchParams.get("order") ?? "")
        .split(",")
        .filter(Boolean)
        .map((part) => part.split("."));
      if (order.length && table === "leaderboard_weekly")
        result = [...result].sort((a, b) => {
          for (const [key, dir] of order) {
            const x = a[key!],
              y = b[key!];
            if (x === y) continue;
            if (x == null) return 1;
            if (y == null) return -1;
            const diff = (x as string | number) < (y as string | number) ? -1 : 1;
            return dir === "desc" ? -diff : diff;
          }
          return 0;
        });
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 1000);
      result = result.slice(offset, offset + limit);
    }
    const object = request.headers()["accept"]?.includes("vnd.pgrst.object");
    await route.fulfill({
      status: request.method() === "POST" ? 201 : 200,
      headers: {
        "content-range": `0-${Math.max(0, result.length - 1)}/${result.length}`,
        "access-control-expose-headers": "Content-Range",
      },
      json: object ? (result[0] ?? null) : result,
    });
  });
  return {
    tables,
    loseImportResponse: (after = 1) => {
      loseImportAfter = after;
    },
    loseSetResponse: () => {
      loseNextSetResponse = true;
    },
    setPosts: () => setPosts,
    loseBodyResponse: () => {
      loseNextBodyResponse = true;
    },
    loseWaterResponse: () => {
      loseNextWaterResponse = true;
    },
    loseFoodResponse: () => {
      loseNextFoodResponse = true;
    },
  };
}

for (const locale of ["en", "ar"] as const) {
  test(`Stitch media-first workout and shell preserve drafts in ${locale}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    const backend = await fakeBackend(context, locale),
      version = crypto.randomUUID();
    await trainingFeatures(context, { guidance: true, logging: true, cardio: true });
    await context.route("**/rest/v1/rpc/get_cardio_history", (route) =>
      route.fulfill({ json: [] }),
    );
    backend.tables.program_assignments = [
      { id: crypto.randomUUID(), member_id: userId, program_version_id: version, active: true },
    ];
    backend.tables.program_versions = [
      {
        id: version,
        name: "Studio program",
        version: 1,
        weeks: 1,
        items: [
          {
            id: crypto.randomUUID(),
            exercise_id: exerciseId,
            week: 1,
            day: 1,
            position: 0,
            target_sets: 3,
            target_reps: "8–12",
            name_en: "Bench Press",
            name_ar: "ضغط الصدر",
            muscle: "chest",
            equipment: "barbell",
            logging_mode: "weighted_reps",
            load_convention: "external_total",
          },
        ],
      },
    ];
    const externalFonts: string[] = [];
    page.on("request", (request) => {
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(request.url()))
        externalFonts.push(request.url());
    });
    await page.goto("/train");
    const name = (en: string, ar: string) => (locale === "ar" ? ar : en);
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator("[data-studio-shell]")).toBeVisible();
      await expectAlignedControls(page);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `artifacts/studio-shell-${locale}-${width}.png`,
        fullPage: true,
      });
    }
    expect(externalFonts).toEqual([]);
    await page.setViewportSize({ width: 393, height: 850 });
    await page.getByRole("button", { name: name("Cardio", "الكارديو"), exact: true }).click();
    await expect(page).toHaveURL(/section=cardio/);
    await expect(
      page.getByText(name("Cardio & HIIT", "الكارديو وHIIT"), { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: name("Back to workouts", "العودة إلى التمارين"), exact: true })
      .click();
    await page.getByRole("button", { name: name("My program", "برنامجي"), exact: true }).click();
    await page
      .getByRole("button", { name: name("Start this day", "ابدأ هذا اليوم"), exact: true })
      .click();
    const first = page.getByRole("group", {
      name: name("Planned set 1", "مجموعة مخططة 1"),
      exact: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const preview = page.locator("[data-exercise-preview]");
    await expect(preview).toBeVisible();
    const previewBox = (await preview.boundingBox())!;
    expect(previewBox.x).toBe(16);
    expect(previewBox.width).toBe(358);
    expect(await preview.evaluate((node) => getComputedStyle(node).borderTopLeftRadius)).toBe(
      "12px",
    );
    // The demonstration is a thumbnail so the set inputs stay on the first screen.
    await expect(
      preview.getByRole("button", { name: /View exercise demonstration|عرض الشرح المرئي/ }),
    ).toBeVisible();
    expect((await first.boundingBox())!.y + 100).toBeLessThan(844);
    await page.screenshot({ path: `artifacts/stitch-workout-${locale}-390.png`, fullPage: true });
    await first.getByLabel("kg", { exact: true }).fill("52.5");
    await first.getByLabel(name("Reps", "التكرارات"), { exact: true }).fill("10");
    await page
      .getByRole("button", { name: name("Effort ratings (RPE)", "تقييم الجهد (RPE)"), exact: true })
      .click();
    await first.getByLabel("RPE 1–10", { exact: true }).fill("7.5");
    await page.getByRole("tab", { name: name("History", "السجل"), exact: true }).click();
    await expect(first).toBeHidden();
    await page.getByRole("tab", { name: name("Log", "التسجيل"), exact: true }).focus();
    await page.keyboard.press("Home");
    await expect(first.getByLabel("kg", { exact: true })).toHaveValue("52.5");
    await page.setViewportSize({ width: 320, height: 850 });
    await expectAlignedControls(page);
    expect((await first.boundingBox())!.height).toBeLessThan(180);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20000 })
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(first.getByLabel("kg", { exact: true })).toHaveValue("52.5");
    await expect(first.getByLabel("RPE 1–10", { exact: true })).toHaveValue("7.5");
    await page.evaluate(() => window.scrollTo(0, 0));
    const thumb = preview.getByRole("button", {
      name: /View exercise demonstration|عرض الشرح المرئي/,
    });
    await expect(thumb).toBeVisible();
    expect((await thumb.boundingBox())!.y).toBeLessThan((await first.boundingBox())!.y);
    await page.screenshot({ path: `artifacts/studio-workout-${locale}-320.png`, fullPage: true });
    await page
      .getByRole("button", { name: name("Log set 1", "تسجيل المجموعة 1"), exact: true })
      .click();
    await context.setOffline(false);
    await page
      .getByRole("button", { name: name("Exercise options", "خيارات التمرين"), exact: true })
      .click();
    await page
      .getByRole("button", { name: name("Retry sync", "إعادة المزامنة"), exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
    expect(backend.tables.set_logs![0]).toMatchObject({ weight_kg: 52.5, reps: 10, rpe: 7.5 });
  });
}

async function chooseFromLibrary(page: Page, name: string) {
  const row = page.getByRole("dialog").getByRole("listitem").filter({ hasText: name });
  const add = row.getByRole("button", { name: "Add", exact: true });
  if (await add.count()) {
    await add.click();
    await page.getByRole("button", { name: "Insert selected exercises", exact: true }).click();
  } else await row.getByRole("button", { name: "Use", exact: true }).click();
}

for (const locale of ["en", "ar"] as const) {
  test(`Train switcher stays stable across sections and viewport sizes in ${locale}`, async ({
    page,
    context,
  }) => {
    await fakeBackend(context, locale);
    await page.goto("/train");
    const navigation = page.getByRole("navigation", {
      name: locale === "ar" ? "أقسام التدريب" : "Training sections",
      exact: true,
    });
    await expect(navigation).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const slider = navigation.locator("[data-section-slider]");
    await expect(slider).toBeVisible();
    await expect(slider).toHaveCSS("transition-property", /transform/);
    await expect(slider).toHaveCSS("transition-duration", /0.2s/);
    const labels =
      locale === "ar" ? ["تمرين", "برنامجي", "السجل"] : ["Workout", "My program", "History"];
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      let baseline: { x: number; y: number; width: number; height: number } | undefined;
      for (const label of [...labels, labels[0]!]) {
        const selected = navigation.getByRole("button", { name: label, exact: true });
        await selected.click();
        await expect(selected).toHaveAttribute("aria-pressed", "true");
        await expect(navigation.locator('[aria-pressed="true"]')).toHaveCount(1);
        await expect
          .poll(async () => {
            const indicator = (await slider.boundingBox())!;
            const button = (await selected.boundingBox())!;
            return Math.max(
              Math.abs(indicator.x - button.x),
              Math.abs(indicator.width - button.width),
            );
          })
          .toBeLessThanOrEqual(1);
        await page.evaluate(() => window.scrollTo(0, 0));
        const box = (await navigation.boundingBox())!;
        baseline ??= box;
        for (const key of ["x", "y", "width", "height"] as const)
          expect(Math.abs(box[key] - baseline[key])).toBeLessThanOrEqual(1);
        const buttons = await navigation.getByRole("button").all();
        const sizes = await Promise.all(buttons.map((button) => button.boundingBox()));
        for (const size of sizes) {
          expect(size!.height).toBeGreaterThanOrEqual(44);
          expect(Math.abs(size!.width - sizes[0]!.width)).toBeLessThanOrEqual(1);
          expect(size!.x).toBeGreaterThanOrEqual(0);
          expect(size!.x + size!.width).toBeLessThanOrEqual(width + 1);
        }
        if (width === 390)
          await navigation.screenshot({
            path: `artifacts/train-switcher-${locale}-${labels.indexOf(label)}.png`,
          });
      }
    }
    await navigation.getByRole("button", { name: labels[1], exact: true }).click();
    await page.reload();
    await expect(navigation.getByRole("button", { name: labels[1], exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await navigation.getByRole("button", { name: labels[2], exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(navigation.getByRole("button", { name: labels[2], exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(slider).toHaveCSS("transition-property", "none");
    await expect
      .poll(async () => {
        const indicator = (await slider.boundingBox())!;
        const button = (await navigation
          .getByRole("button", { name: labels[2], exact: true })
          .boundingBox())!;
        return Math.abs(indicator.x - button.x);
      })
      .toBeLessThanOrEqual(1);
  });

  test(`Stitch program weeks and day cards retain frozen targets in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    const version = crypto.randomUUID();
    const items = [
      {
        id: crypto.randomUUID(),
        week: 1,
        day: 1,
        position: 0,
        exercise_id: exerciseId,
        name_en: "Frozen Bench",
        name_ar: "ضغط الصدر المعتمد",
        muscle: "chest",
        equipment: "barbell",
        target_sets: 3,
        target_reps: "8–12",
        logging_mode: "weighted_reps",
        load_convention: "external_total",
      },
      {
        id: crypto.randomUUID(),
        week: 1,
        day: 2,
        position: 0,
        exercise_id: secondExercise,
        name_en: "Frozen Row",
        name_ar: "سحب معتمد",
        muscle: "back",
        equipment: "barbell",
        target_sets: 4,
        target_reps: "6–8",
        logging_mode: "weighted_reps",
        load_convention: "external_total",
      },
      {
        id: crypto.randomUUID(),
        week: 2,
        day: 3,
        position: 0,
        exercise_id: exerciseId,
        name_en: "Frozen Bench",
        name_ar: "ضغط الصدر المعتمد",
        muscle: "chest",
        equipment: "barbell",
        target_sets: 2,
        target_reps: "10–12",
        logging_mode: "weighted_reps",
        load_convention: "external_total",
      },
    ];
    backend.tables.program_assignments = [
      { id: crypto.randomUUID(), member_id: userId, program_version_id: version, active: true },
    ];
    backend.tables.program_versions = [
      { id: version, name: "Frozen training block", version: 2, weeks: 2, items },
    ];
    const label = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await page.goto("/train?section=program");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-stitch-program]")).toBeVisible();
    await expect(page.locator("[data-program-day]")).toHaveCount(2);
    await expect(page.getByText(label("Frozen Row", "سحب معتمد"), { exact: true })).toBeHidden();
    await page.locator("[data-program-day]").nth(1).locator("summary").click();
    await expect(page.getByText(label("Frozen Row", "سحب معتمد"), { exact: true })).toBeVisible();
    await expectAlignedControls(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/stitch-program-${locale}-390.png`, fullPage: true });
    await page
      .getByRole("navigation", { name: label("Program weeks", "أسابيع البرنامج"), exact: true })
      .getByRole("button")
      .nth(1)
      .click();
    await expect(page.locator("[data-program-day]")).toHaveCount(1);
    await expect(page.locator("[data-program-day]")).toContainText("2 × 10–12");
    await page
      .getByRole("button", { name: label("Start this day", "ابدأ هذا اليوم"), exact: true })
      .click();
    await expect(
      page.getByRole("group", { name: label("Planned set 1", "مجموعة مخططة 1"), exact: true }),
    ).toBeVisible();
    expect(backend.tables.program_versions![0]!.items).toEqual(items);
  });
}

async function expectAlignedControls(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const errors: string[] = [],
          width = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth > width + 1) {
          errors.push(`Page overflows: ${document.documentElement.scrollWidth}/${width}`);
          for (const el of [...document.querySelectorAll("main *")]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && (r.left < -1 || r.right > width + 1);
            })
            .slice(0, 8)) {
            const r = el.getBoundingClientRect();
            errors.push(`${el.tagName}.${el.className}: ${r.left}/${r.right}`);
          }
        }
        for (const node of document.querySelectorAll<HTMLSelectElement>("select")) {
          const box = node.getBoundingClientRect(),
            style = getComputedStyle(node);
          if (!box.width || !box.height || style.visibility === "hidden") continue;
          const name =
            node.getAttribute("aria-label") ||
            node.closest("label")?.textContent?.trim().slice(0, 50) ||
            node.id;
          if (box.left < -1 || box.right > width + 1)
            errors.push(`${name}: outside viewport ${box.left}/${box.right}`);
          if (box.height < 43) errors.push(`${name}: target height ${box.height}`);
          if (parseFloat(style.paddingInlineStart) < 11 || parseFloat(style.paddingInlineEnd) < 35)
            errors.push(`${name}: missing text/chevron padding`);
          const label = node.closest("label");
          if (!label || getComputedStyle(label).display.includes("flex")) continue;
          const lines = [...label.childNodes]
            .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
            .flatMap((n) => {
              const range = document.createRange();
              range.selectNodeContents(n);
              return [...range.getClientRects()].filter((r) => r.height > 0);
            });
          if (lines.length && box.top < Math.max(...lines.map((r) => r.bottom)) + 5)
            errors.push(`${name}: label/control gap is too small`);
        }
        return errors;
      }),
    )
    .toEqual([]);
}

async function openCardioHistory(page: Page) {
  const history = page.locator("[data-cardio-history]");
  await expect(history).toBeVisible();
  if ((await history.getAttribute("open")) !== null) return;
  // Keyboard toggle: in CI the panel container sometimes took the tap after a HIIT save.
  await history.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(history).toHaveAttribute("open", "");
}

for (const locale of ["en", "ar"] as const) {
  test(`member controls align across narrow mobile and desktop in ${locale}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await fakeBackend(context, locale);
    await trainingFeatures(context, { cardio: true, social: true, imports: true });
    await context.route("**/rest/v1/rpc/get_cardio_history", (r) => r.fulfill({ json: [] }));
    await context.route("**/rest/v1/rpc/social_action", (r) =>
      r.fulfill({
        json: {
          account: {
            member_id: userId,
            code: "PF-1234567890ABCDEF",
            discoverable: false,
            sharing: false,
          },
          friends: [],
          blocked: [],
          challenges: [],
        },
      }),
    );
    for (const width of [320, 393, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto("/train");
      await page
        .getByRole("button", { name: locale === "ar" ? "الكارديو" : "Cardio", exact: true })
        .click();
      await page
        .getByText(locale === "ar" ? "الكارديو وHIIT" : "Cardio & HIIT", { exact: true })
        .click();
      const filter = page.getByRole("combobox", {
        name: locale === "ar" ? "تصفية نشاط السجل" : "History activity filter",
        exact: true,
      });
      await openCardioHistory(page);
      await expect(filter).toBeVisible();
      await expectAlignedControls(page);
      if (width === 320) {
        await filter.focus();
        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        await expect(filter).toHaveValue("hiit");
        await page.keyboard.press("Escape");
        await filter
          .locator("..")
          .screenshot({ path: `artifacts/alignment-history-filter-${locale}.png` });
        await page.screenshot({
          path: `artifacts/alignment-train-${locale}-320.png`,
          fullPage: true,
        });
      }
      for (const route of [
        "/progress?section=strength",
        "/profile?section=preferences",
        "/profile?section=privacy",
        "/rewards?section=community",
        "/nutrition?entry=quick",
      ]) {
        await page.goto(route);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.locator("select").first()).toBeVisible();
        await expectAlignedControls(page);
      }
    }
  });
  test(`admin filter controls align across narrow mobile and desktop in ${locale}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    const backend = await fakeBackend(context, locale);
    backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
    for (const width of [320, 393, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      for (const route of [
        "/admin/members",
        "/admin/exercises",
        "/admin/invites",
        "/admin/pv",
        "/members",
      ]) {
        await page.goto(route);
        await expect(page.locator("select").first()).toBeVisible();
        await expectAlignedControls(page);
      }
      if (width === 320)
        await page.screenshot({
          path: `artifacts/alignment-admin-${locale}-320.png`,
          fullPage: true,
        });
    }
  });
}

test("editable decimal actual weight survives offline reload and discard is outside collapsed notes", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  const weight = page.getByLabel("kg", { exact: true });
  await weight.fill("");
  await weight.fill("22.5");
  await page.getByLabel("Reps", { exact: true }).fill("8");
  const discard = page.getByRole("button", { name: "Discard workout", exact: true });
  const notes = page
    .locator("details")
    .filter({ has: page.getByText("Session notes & recovery", { exact: true }) });
  await expect(notes).not.toHaveAttribute("open");
  await expect(discard).toBeVisible();
  await expect(notes.getByRole("button", { name: "Discard workout", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Rest settings", exact: true }).click();
  const settings = page.getByRole("dialog");
  await settings.getByRole("slider", { name: /Alert volume/ }).fill("90");
  await settings.getByLabel("Mute rest sound", { exact: true }).check();
  await settings.getByRole("button", { name: "Preview alert", exact: true }).click();
  await settings.getByRole("button", { name: "Save", exact: true }).click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(weight).toHaveValue("22.5");
  await context.setOffline(false);
  await expect(notes).not.toHaveAttribute("open");
  await discard.click();
  const review = page.getByRole("dialog");
  await expect(review).toContainText("logged sets");
  await expect(
    review.getByRole("button", { name: "Export backup before discarding", exact: true }),
  ).toBeVisible();
  await review.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(weight).toHaveValue("22.5");
});

test("exercise picker exposes failed local saves and retries without losing the choice", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Add exercise", exact: true });
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let failures = 2;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.name === "workouts" && (args[0] as { plan?: unknown[] }).plan?.length) {
        if (--failures === 0) IDBObjectStore.prototype.put = original;
        if (failures >= 0) throw new DOMException("Device storage is full", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  await chooseFromLibrary(page, "Barbell Row");
  await expect(picker.getByRole("alert")).toContainText("Device storage is full");
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: /^Barbell Row/ }).click();
  const detail = page.getByRole("dialog", { name: "Barbell Row", exact: true });
  await detail.getByRole("button", { name: "Use exercise", exact: true }).click();
  await expect(detail).toBeHidden();
  await picker.getByRole("button", { name: "Insert selected exercises", exact: true }).click();
  await expect(picker.getByRole("alert")).toContainText("Device storage is full");
  await picker.getByRole("button", { name: "Insert selected exercises", exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.locator(`[data-exercise-id="${secondExercise}"]`)).toHaveCount(1);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20000 })
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(`[data-exercise-id="${secondExercise}"]`)).toHaveCount(1);
});

for (const locale of ["en", "ar"] as const) {
  test(`Stitch picker inserts a staged batch atomically across filters and offline retries in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    backend.tables.exercises![0]!.name_ar = "ضغط الصدر";
    backend.tables.exercises![1]!.name_ar = "سحب بالبار";
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await page.goto("/train");
    await page
      .getByRole("button", { name: l("Start workout", "ابدأ التمرين"), exact: true })
      .click();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20000 })
      .toBe(true);
    await context.setOffline(true);
    await page.getByRole("button", { name: l("Add exercise", "إضافة تمرين"), exact: true }).click();
    const picker = page.getByRole("dialog", {
      name: l("Add exercise", "إضافة تمرين"),
      exact: true,
    });
    const add = (name: string) =>
      picker
        .getByRole("listitem")
        .filter({ hasText: name })
        .getByRole("button", { name: l("Add", "أضف"), exact: true });
    await add(l("Bench Press", "ضغط الصدر")).click();
    await picker
      .getByRole("button", { name: l("Browse by muscle", "تصفح حسب العضلة"), exact: true })
      .click();
    await picker
      .getByRole("group", { name: l("Muscle", "العضلة"), exact: true })
      .getByRole("button", { name: l("Back", "الظهر"), exact: true })
      .click();
    await add(l("Barbell Row", "سحب بالبار")).click();
    await expect(
      picker.getByRole("button", {
        name: l("Insert selected exercises", "إدراج التمارين المحددة"),
        exact: true,
      }),
    ).toContainText("2");
    expect(await page.locator(`[data-exercise-id="${secondExercise}"]`).count()).toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await picker.screenshot({ path: `artifacts/stitch-picker-${locale}-390.png` });
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
        if (this.name === "workouts" && (args[0] as { plan?: unknown[] }).plan?.length === 2) {
          IDBObjectStore.prototype.put = original;
          throw new DOMException("Device storage is full", "QuotaExceededError");
        }
        return original.apply(this, args);
      };
    });
    const insert = picker.getByRole("button", {
      name: l("Insert selected exercises", "إدراج التمارين المحددة"),
      exact: true,
    });
    await insert.click();
    await expect(picker.getByRole("alert")).toContainText("Device storage is full");
    expect(await page.locator(`[data-exercise-id="${secondExercise}"]`).count()).toBe(0);
    await insert.click();
    await expect(picker).toBeHidden();
    await expect(page.locator("[data-exercise-slot]")).toHaveCount(2);
    const slots = await page
      .locator("[data-exercise-slot]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-exercise-slot")));
    expect(new Set(slots).size).toBe(2);
    await page.reload();
    await expect(page.locator("[data-exercise-slot]")).toHaveCount(2);
    expect(
      await page
        .locator("[data-exercise-slot]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-exercise-slot"))),
    ).toEqual(slots);
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`advanced configuration saves before returning focus and preserves planned sets offline in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    await trainingFeatures(context, { logging: true });
    const version = crypto.randomUUID();
    backend.tables.program_assignments = [
      { id: crypto.randomUUID(), member_id: userId, program_version_id: version, active: true },
    ];
    backend.tables.program_versions = [
      {
        id: version,
        name: "Configuration test plan",
        version: 1,
        weeks: 1,
        items: [
          {
            id: crypto.randomUUID(),
            exercise_id: exerciseId,
            week: 1,
            day: 1,
            position: 0,
            target_sets: 2,
            target_reps: "8–12",
            name_en: "Bench Press",
            name_ar: "ضغط الصدر",
            muscle: "chest",
            equipment: "barbell",
            logging_mode: "weighted_reps",
            load_convention: "external_total",
          },
        ],
      },
    ];
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await page.goto("/train?section=program");
    await page
      .getByRole("button", { name: l("Start this day", "ابدأ هذا اليوم"), exact: true })
      .click();
    const planned = page.getByRole("group", {
      name: l("Planned set 1", "مجموعة مخططة 1"),
      exact: true,
    });
    await planned.getByLabel("kg", { exact: true }).fill("50");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20000 })
      .toBe(true);
    await context.setOffline(true);
    await page
      .getByRole("button", { name: l("Exercise options", "خيارات التمرين"), exact: true })
      .click();
    const options = page.getByRole("dialog", {
      name: l("Exercise options", "خيارات التمرين"),
      exact: true,
    });
    await options.getByRole("radio", { name: l("Warm-up", "إحماء"), exact: true }).check();
    const weight = options.getByLabel(
      l("Additional set weight (kg)", "وزن المجموعة الإضافية (kg)"),
      { exact: true },
    );
    const reps = options.getByLabel(l("Additional set reps", "تكرارات المجموعة الإضافية"), {
      exact: true,
    });
    await weight.fill("62.5");
    await reps.fill("9");
    await options.getByRole("button", { name: "RPE 7.5", exact: true }).click();
    await expect(options.getByRole("button", { name: "RPE 7.5", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await options.getByRole("button", { name: "RPE 7.5", exact: true }).click();
    await expect(
      options.getByLabel(l("Additional-set RPE", "جهد المجموعة الإضافية"), { exact: true }),
    ).toHaveValue("");
    await options.getByRole("button", { name: "RPE 7.5", exact: true }).click();
    const rest = options.getByLabel(
      l("Additional-set rest seconds", "ثواني راحة المجموعة الإضافية"),
      { exact: true },
    );
    const next = options.getByRole("button", {
      name: l("Continue to set entry", "المتابعة إلى إدخال المجموعة"),
      exact: true,
    });
    await rest.fill("1000");
    await next.click();
    await expect(options.getByRole("alert")).toContainText("600");
    await expect(options.getByRole("alert")).toBeInViewport();
    await rest.fill("141");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve, reject) => {
              const request = indexedDB.open("prime-fitness-workouts");
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const database = request.result;
                const read = database.transaction("workouts").objectStore("workouts").getAll();
                read.onsuccess = () => {
                  const value = read.result.find(
                    (workout: {
                      editor?: {
                        drafts?: Record<string, { weight: string; reps: string; rpe: string }>;
                      };
                    }) =>
                      Object.values(workout.editor?.drafts ?? {}).some(
                        (draft) =>
                          draft.weight === "62.5" && draft.reps === "9" && draft.rpe === "7.5",
                      ),
                  );
                  database.close();
                  resolve(!!value);
                };
                read.onerror = () => {
                  database.close();
                  reject(read.error);
                };
              };
            }),
        ),
      )
      .toBe(true);
    await options.evaluate((element) => {
      element.scrollTop = 0;
    });
    await options.screenshot({ path: `artifacts/stitch-advanced-ready-${locale}.png` });
    await page.setViewportSize({ width: 320, height: 420 });
    await expect(options).toBeVisible();
    const box = (await options.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(421);
    expect(
      await options.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
        if (this.name === "workouts" && JSON.stringify(args[0]).includes('"weight":"62.5"')) {
          IDBObjectStore.prototype.put = original;
          throw new DOMException("Device storage is full", "QuotaExceededError");
        }
        return original.apply(this, args);
      };
    });
    await next.click();
    await expect(options.getByRole("alert")).toContainText("Device storage is full");
    await expect(options.getByRole("alert")).toBeInViewport();
    await expect(weight).toHaveValue("62.5");
    expect(backend.tables.set_logs).toHaveLength(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await options.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1);
    await options.evaluate((element) => {
      element.scrollTop = 0;
    });
    await options.screenshot({ path: `artifacts/stitch-advanced-config-${locale}.png` });
    await next.click();
    await expect(options).toBeHidden();
    const entry = page.locator("[data-advanced-set-entry]");
    await expect(entry.getByLabel("kg", { exact: true })).toBeFocused();
    await expect(entry.getByLabel("kg", { exact: true })).toHaveValue("62.5");
    await expect(planned.getByLabel("kg", { exact: true })).toHaveValue("50");
    await expect(
      page.getByRole("combobox", { name: l("Rest", "الراحة"), exact: true }),
    ).toHaveValue("141");
    await page.reload();
    await page
      .getByRole("button", {
        name: l("Additional / advanced set", "مجموعة إضافية / متقدمة"),
        exact: true,
      })
      .click();
    await expect(entry.getByLabel("kg", { exact: true })).toHaveValue("62.5");
    await expect(entry.getByLabel("RPE 1–10", { exact: true })).toHaveValue("7.5");
    await expect(planned.getByLabel("kg", { exact: true })).toHaveValue("50");
    await entry.getByRole("button", { name: l("Log set", "سجّل"), exact: true }).click();
    await context.setOffline(false);
    await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
    expect(backend.tables.set_logs![0]).toMatchObject({
      set_role: "warmup",
      weight_kg: 62.5,
      reps: 9,
      rpe: 7.5,
    });
  });
}

test("scanner availability failures have an explicit retry instead of disappearing", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  let unavailable = true;
  await context.route("**/rest/v1/rpc/get_training_features", (route) =>
    unavailable
      ? route.fulfill({ status: 503, json: { message: "Feature check unavailable" } })
      : route.fulfill({ json: { food_scanning: true } }),
  );
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Add food", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText(
    "Could not check food scanning availability",
  );
  unavailable = false;
  await dialog.getByRole("button", { name: "Retry scanner availability", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Scan barcode or nutrition label", exact: true })
    .click();
  await expect(dialog.getByLabel("Barcode number", { exact: true })).toBeVisible();
});

test("label scan review fills the normal food editor without saving unconfirmed macros", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { food_scanning: true });
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Add food", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Scan barcode or nutrition label", exact: true })
    .click();
  const scanner = dialog.locator("section").filter({
    has: page.getByRole("button", { name: "Scan barcode or nutrition label", exact: true }),
  });
  await scanner
    .getByLabel("Label text (optional manual paste)", { exact: true })
    .fill("Energy 120 kcal\nProtein 4 g\nCarbs 15 g\nTotal fat 2 g");
  await scanner.getByRole("button", { name: "Read pasted label", exact: true }).click();
  await scanner.getByLabel("Food name", { exact: true }).fill("Reviewed label");
  await scanner
    .getByLabel("Serving basis, e.g. 100 g or 1 bottle", { exact: true })
    .fill("1 bottle");
  await expect(
    scanner.getByRole("button", { name: "Use reviewed values in food editor", exact: true }),
  ).toBeDisabled();
  expect(backend.tables.food_logs).toHaveLength(0);
  await scanner
    .getByLabel("I reviewed the serving and all nutrient values", { exact: true })
    .check();
  await scanner
    .getByRole("button", { name: "Use reviewed values in food editor", exact: true })
    .click();
  expect(backend.tables.food_logs).toHaveLength(0);
  await dialog.getByRole("button", { name: "Add food", exact: true }).click();
  await expect.poll(() => backend.tables.food_logs?.length).toBe(1);
  expect(backend.tables.food_logs![0]).toMatchObject({
    name: "Reviewed label",
    calories: 120,
    protein_g: 4,
    carbs_g: 15,
    fat_g: 2,
  });
});

for (const locale of ["en", "ar"] as const) {
  test(`Stitch cardio and HIIT retain configuration and recover a paused timer offline in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    await trainingFeatures(context, { cardio: true });
    const accepted = new Map<string, Row>();
    await context.route("**/rest/v1/rpc/get_cardio_history", (route) =>
      route.fulfill({ json: [] }),
    );
    await context.route("**/rest/v1/rpc/save_cardio_log", (route) => {
      const body = route.request().postDataJSON();
      const record = {
        ...body._data,
        id: body._id,
        member_id: userId,
        revision: body._expected + 1,
        deleted_at: null,
      };
      accepted.set(record.id, record);
      return route.fulfill({ json: { status: "applied", record, revision: record.revision } });
    });
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await page.goto("/train?section=cardio");
    const hiit = page.getByRole("region", { name: "HIIT", exact: true });
    await hiit.getByLabel(l("Work seconds", "ثواني العمل"), { exact: true }).fill("45");
    await hiit.getByLabel(l("Rest seconds", "ثواني الراحة"), { exact: true }).fill("15");
    await hiit.getByLabel(l("Rounds", "الجولات"), { exact: true }).fill("12");
    await hiit.getByLabel(l("Preparation seconds", "ثواني الاستعداد"), { exact: true }).fill("0");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/cardio-reference-ready-${locale}.png`,
      fullPage: true,
    });
    await expect(page.locator("[data-cardio-history]")).not.toHaveAttribute("open", "");
    await expect(
      page.getByRole("combobox", {
        name: l("History activity filter", "تصفية نشاط السجل"),
        exact: true,
      }),
    ).toBeHidden();
    await hiit.getByLabel(l("Work seconds", "ثواني العمل"), { exact: true }).fill("3");
    await hiit.getByLabel(l("Rest seconds", "ثواني الراحة"), { exact: true }).fill("1");
    await hiit.getByLabel(l("Rounds", "الجولات"), { exact: true }).fill("2");
    await hiit.getByLabel(l("Preparation seconds", "ثواني الاستعداد"), { exact: true }).fill("0");
    await expect(hiit.locator("[data-interval-clock]")).toContainText("0:03");
    await page
      .getByRole("button", { name: l("Steady-state cardio", "كارديو مستمر"), exact: true })
      .click();
    await page.getByLabel(l("Duration (minutes)", "المدة (دقائق)"), { exact: true }).fill("6.5");
    await page.getByRole("button", { name: l("Cycling", "الدراجة"), exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAlignedControls(page);
    await page.screenshot({ path: `artifacts/stitch-cardio-log-${locale}.png`, fullPage: true });
    await page
      .getByRole("button", { name: l("HIIT intervals", "فترات HIIT"), exact: true })
      .click();
    await expect(hiit.getByLabel(l("Work seconds", "ثواني العمل"), { exact: true })).toHaveValue(
      "3",
    );
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expectAlignedControls(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const summaryBox = (await hiit
      .getByRole("heading", { name: l("Last 7 days", "آخر 7 أيام"), exact: true })
      .boundingBox())!;
    const startBox = (await hiit
      .getByRole("button", { name: l("Start HIIT", "بدء HIIT"), exact: true })
      .boundingBox())!;
    expect(startBox.y).toBeGreaterThan(summaryBox.y + summaryBox.height);
    expect(startBox.height).toBeGreaterThanOrEqual(48);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/stitch-hiit-ready-${locale}.png`, fullPage: true });
    await page
      .getByRole("button", { name: l("Steady-state cardio", "كارديو مستمر"), exact: true })
      .click();
    await expect(
      page.getByLabel(l("Duration (minutes)", "المدة (دقائق)"), { exact: true }),
    ).toHaveValue("6.5");
    await expect(
      page.getByRole("button", { name: l("Cycling", "الدراجة"), exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: l("HIIT intervals", "فترات HIIT"), exact: true })
      .click();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await hiit.getByLabel(l("Work seconds", "ثواني العمل"), { exact: true }).fill("0");
    await hiit.getByRole("button", { name: l("Start HIIT", "بدء HIIT"), exact: true }).click();
    await expect(hiit.getByRole("alert")).toContainText(l("24 hours", "24 ساعة"));
    await expect(hiit.getByRole("alert")).toBeInViewport();
    await hiit.getByLabel(l("Work seconds", "ثواني العمل"), { exact: true }).fill("3");
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
        if (
          this.name === "member_references" &&
          JSON.stringify(args[0]).includes('"saved":false')
        ) {
          IDBObjectStore.prototype.put = original;
          throw new DOMException("Device storage is full", "QuotaExceededError");
        }
        return original.apply(this, args);
      };
    });
    await hiit.getByRole("button", { name: l("Start HIIT", "بدء HIIT"), exact: true }).click();
    await expect(hiit.getByRole("alert")).toContainText("Device storage is full");
    await expect(hiit.getByRole("alert")).toBeInViewport();
    await hiit.getByRole("button", { name: l("Start HIIT", "بدء HIIT"), exact: true }).click();
    const pause = hiit.getByRole("button", {
      name: l("Pause intervals", "إيقاف الفترات مؤقتاً"),
      exact: true,
    });
    await expect(pause).toBeInViewport();
    const configuration = hiit.getByRole("heading", {
      name: l("Your interval protocol", "بروتوكول الفترات الخاص بك"),
      exact: true,
    });
    expect((await pause.boundingBox())!.y).toBeLessThan((await configuration.boundingBox())!.y);
    await hiit
      .getByRole("button", { name: l("Pause intervals", "إيقاف الفترات مؤقتاً"), exact: true })
      .click();
    await expect(
      hiit.getByRole("button", { name: l("Resume intervals", "متابعة الفترات"), exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/stitch-hiit-paused-${locale}.png`, fullPage: true });
    await page.reload();
    await hiit
      .getByRole("button", { name: l("Resume intervals", "متابعة الفترات"), exact: true })
      .click();
    await hiit
      .getByRole("button", { name: l("Save completed HIIT", "حفظ HIIT المكتمل"), exact: true })
      .click({ timeout: 12000 });
    await openCardioHistory(page);
    await expect(
      page
        .locator("[data-cardio-history] li")
        .getByText("0.1 " + l("min", "د"), { exact: false })
        .first(),
    ).toBeVisible();
    await page.getByRole("button", { name: l("Edit", "تعديل"), exact: true }).click();
    await expect(
      page.getByLabel(l("Activity date", "تاريخ النشاط"), { exact: true }),
    ).toBeFocused();
    await expect(
      page.getByLabel(l("Duration (minutes)", "المدة (دقائق)"), { exact: true }),
    ).toBeDisabled();
    await expect(page.locator("[data-cardio-history]")).not.toHaveAttribute("open", "");
    await page
      .getByRole("button", { name: l("Cancel edit", "إلغاء التعديل"), exact: true })
      .click();
    await page.reload();
    await expect(
      hiit.getByRole("button", { name: l("Start HIIT", "بدء HIIT"), exact: true }),
    ).toBeVisible();
    expect(accepted.size).toBe(0);
    await openCardioHistory(page);
    await context.setOffline(false);
    await page
      .getByRole("button", { name: new RegExp(l("Retry cardio sync", "إعادة مزامنة الكارديو")) })
      .click();
    await expect.poll(() => accepted.size).toBe(1);
    expect([...accepted.values()][0]).toMatchObject({
      activity: "hiit",
      duration_seconds: 7,
      intervals: { rounds: 2, work: 3, rest: 1, prepare: 0 },
    });
    expect(backend.tables.set_logs).toHaveLength(0);
    expect(backend.tables.workout_sessions).toHaveLength(0);
  });
}

test("cardio logs remain available after an offline reload and sync with one stable identity", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  await trainingFeatures(context, { cardio: true });
  const accepted = new Map<string, Row>();
  await context.route("**/rest/v1/rpc/get_cardio_history", (route) =>
    route.fulfill({ json: [...accepted.values()] }),
  );
  await context.route("**/rest/v1/rpc/save_cardio_log", (route) => {
    const body = route.request().postDataJSON();
    const row = {
      ...body._data,
      id: body._id,
      member_id: userId,
      revision: body._expected + 1,
      deleted_at: null,
    };
    accepted.set(body._id, row);
    return route.fulfill({ json: { status: "applied", record: row, revision: row.revision } });
  });
  await page.goto("/train?section=cardio");
  await page.getByRole("button", { name: "Steady-state cardio", exact: true }).click();
  await page.getByLabel("Duration (minutes)", { exact: true }).fill("12.5");
  await page.getByLabel("Distance (km)", { exact: true }).fill("2");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save cardio on this device", exact: true }).click();
  await expect(
    page.locator("[data-cardio-history] li").getByText("12.5 min", { exact: false }).first(),
  ).toBeVisible();
  await page.reload();
  await openCardioHistory(page);
  await expect(
    page.locator("[data-cardio-history] li").getByText("12.5 min", { exact: false }).first(),
  ).toBeVisible();
  expect(accepted.size).toBe(0);
  await context.setOffline(false);
  await page.getByRole("button", { name: /Retry cardio sync/ }).click();
  await expect.poll(() => accepted.size).toBe(1);
  expect([...accepted.values()][0]).toMatchObject({ duration_seconds: 750, distance_m: 2000 });
});

test("cardio conflicts show both records and resubmit against the reviewed server revision", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  await trainingFeatures(context, { cardio: true });
  const requests: Row[] = [];
  await context.route("**/rest/v1/rpc/get_cardio_history", (route) => route.fulfill({ json: [] }));
  await context.route("**/rest/v1/rpc/save_cardio_log", (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const row = {
      ...body._data,
      id: body._id,
      member_id: userId,
      revision: body._expected === 0 ? 3 : 4,
      deleted_at: null,
    };
    return route.fulfill({
      json:
        body._expected === 0
          ? {
              status: "conflict",
              record: { ...row, notes: "Server note", duration_seconds: 1800 },
              revision: 3,
            }
          : { status: "applied", record: row, revision: 4 },
    });
  });
  await page.goto("/train?section=cardio");
  await page.getByRole("button", { name: "Steady-state cardio", exact: true }).click();
  await page.getByLabel("Duration (minutes)", { exact: true }).fill("12");
  await page.getByLabel("Notes", { exact: true }).fill("My cardio note");
  await page.getByRole("button", { name: "Save cardio on this device", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review cardio sync", exact: true })).toBeVisible();
  await page.locator("[data-cardio-history] > summary").click();
  await expect(page.getByRole("heading", { name: "Server version", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Review cardio sync", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your device version", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Server version", exact: true })).toBeVisible();
  await expect(page.getByText("Server note", { exact: true })).toBeVisible();
  await expect(page.getByText("My cardio note", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Submit local against latest revision", exact: true })
    .click();
  await page.getByRole("button", { name: /Retry cardio sync/ }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]?._expected).toBe(3);
  expect(requests[1]?._id).toBe(requests[0]?._id);
  await expect(page.getByRole("heading", { name: "Server version", exact: true })).toHaveCount(0);
});

test("member-code discovery is opt-in and a reviewed friend request uses the social operation", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  await trainingFeatures(context, { social: true });
  const friend = crypto.randomUUID();
  const state = {
    account: {
      member_id: userId,
      code: "PF-1234567890ABCDEF",
      discoverable: false,
      sharing: false,
    },
    friends: [] as Row[],
    blocked: [],
    challenges: [],
  };
  await context.route("**/rest/v1/rpc/social_action", (route) => {
    const body = route.request().postDataJSON();
    if (body._op === "lookup")
      return route.fulfill({ json: { member_id: friend, name: "Training Friend" } });
    if (body._op === "preferences") Object.assign(state.account, body._data);
    if (body._op === "request")
      state.friends = [
        { member_id: friend, name: "Training Friend", status: "pending", incoming: false },
      ];
    return route.fulfill({ json: state });
  });
  await page.goto("/rewards?section=community");
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await expect(page.getByText("PF-1234567890ABCDEF", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Find member", exact: true })).toBeDisabled();
  await page.getByLabel("Allow exact-code discovery and friend requests", { exact: true }).check();
  await page.getByLabel("Exact member code", { exact: true }).fill("pf-ABCDEF1234567890");
  await page.getByRole("button", { name: "Find member", exact: true }).click();
  await expect(page.getByText("Training Friend", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Send friend request", exact: true }).click();
  await expect(page.getByText("Request sent", { exact: false })).toBeVisible();
});

test("focused exercise cards retain drafts and edit the original set with delete undo", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await page.goto("/train");
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link"),
  ).toHaveCount(5);
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  await page.getByLabel("Reps", { exact: true }).fill("6");
  await page.getByLabel("kg", { exact: true }).fill("60");
  await page.getByRole("link", { name: "Minimize", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await page.getByRole("link", { name: /Workout Continue workout/ }).click();
  await expect(page.getByLabel("kg", { exact: true })).toHaveValue("60");
  await page.reload();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("6");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
  const id = backend.tables.set_logs![0]!.id;
  await page.getByRole("button", { name: "Edit set 1", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reps", { exact: true }).fill("8");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs![0]!.reps).toBe(8);
  expect(backend.tables.set_logs![0]!.id).toBe(id);
  await page.getByRole("button", { name: "Delete set 1", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit set 1", exact: true })).toBeVisible();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
  await expect.poll(() => backend.tables.set_logs![0]!.id).toBe(id);
  await page.screenshot({ path: "artifacts/workout-cards-mobile.png", fullPage: true });
});

test("drop segments keep their working root after refresh and root deletion Undo restores every identity", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { logging: true });
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.getByLabel("Reps", { exact: true }).fill("8");
  await page.getByLabel("kg", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
  const root = backend.tables.set_logs![0]!.id;
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page.getByRole("radio", { name: "Working set", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Warm-up", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Drop segment", exact: true })).toBeChecked();
  await page.getByRole("combobox", { name: "Root working set", exact: true }).selectOption(root);
  await page
    .getByRole("dialog", { name: "Exercise options", exact: true })
    .screenshot({ path: "artifacts/stitch-advanced-set-options.png" });
  await page.getByRole("button", { name: "Continue to set entry", exact: true }).click();
  for (const [weight, reps] of [
    [50, 5],
    [40, 4],
  ]) {
    await page.getByLabel("Reps", { exact: true }).fill(String(reps));
    await page.getByLabel("kg", { exact: true }).fill(String(weight));
    await page.getByRole("button", { name: "Log set", exact: true }).click();
  }
  await expect.poll(() => backend.tables.set_logs!.length).toBe(3);
  const identities = backend.tables.set_logs!.map((row) => row.id).sort();
  const segments = backend.tables.set_logs!.filter((row) => row.set_role === "drop");
  expect(segments.map((row) => row.root_set_id)).toEqual([root, root]);
  expect(segments.map((row) => row.segment_index)).toEqual([1, 2]);
  await page.reload();
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Drop segment", exact: true })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "Root working set", exact: true })).toHaveValue(
    root,
  );
  await page.getByRole("combobox", { name: "Side", exact: true }).selectOption("left");
  await expect(
    page.getByRole("combobox", { name: "Root working set", exact: true }).getByRole("option"),
  ).toHaveCount(1);
  await page.getByRole("combobox", { name: "Side", exact: true }).selectOption("bilateral");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Delete set 1", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.map((row) => row.id).sort()).toEqual(identities);
  expect(
    backend.tables.set_logs!.filter((row) => row.set_role === "drop").map((row) => row.root_set_id),
  ).toEqual([root, root]);
});

test("closing notifications keeps unread state until explicitly marked", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.notifications = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      title_en: "Coach updated your plan",
      title_ar: "تحديث البرنامج",
      created_at: new Date().toISOString(),
      read_at: null,
      link: null,
    },
  ];
  await page.goto("/today");
  await page.getByRole("button", { name: "Notifications", exact: true }).first().click();
  await expect(page.getByText("Coach updated your plan", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(backend.tables.notifications[0]!.read_at).toBeNull();
  await page.getByRole("button", { name: "Notifications", exact: true }).first().click();
  await page.getByRole("button", { name: "Mark all read", exact: true }).click();
  await expect.poll(() => backend.tables.notifications![0]!.read_at).toBeTruthy();
});

test("unilateral pairing resumes after refresh and Arabic workout controls fit a narrow screen", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { logging: true });
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page.getByRole("combobox", { name: "Side", exact: true }).selectOption("left");
  await page.keyboard.press("Escape");
  await page.getByLabel("Reps", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Side", exact: true })).toHaveValue("right");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Same as left", exact: true }).click();
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(2);
  expect(backend.tables.set_logs![0]!.pair_id).toBe(backend.tables.set_logs![1]!.pair_id);
  expect(backend.tables.set_logs!.map((r) => r.side)).toEqual(["left", "right"]);
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page.getByRole("combobox", { name: "Side", exact: true }).selectOption("right");
  await trainingFeatures(context, { logging: false });
  await page.reload();
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(3);
  expect(backend.tables.set_logs![2]!.side).toBe("right");
  expect(backend.tables.set_logs![2]!.pair_id).not.toBe(backend.tables.set_logs![0]!.pair_id);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole("link", { name: "Minimize", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await page.getByRole("link", { name: /Workout أكمل التمرين/ }).click();
  await expect(page.getByLabel("التكرارات", { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: "artifacts/workout-cards-ar-mobile.png", fullPage: true });
});

test("planned rows keep distinct values and pair repeated exercise slots with independent rest", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    version = crypto.randomUUID(),
    first = crypto.randomUUID(),
    second = crypto.randomUUID();
  backend.tables.program_assignments = [
    { id: crypto.randomUUID(), member_id: userId, program_version_id: version, active: true },
  ];
  backend.tables.program_versions = [
    {
      id: version,
      name: "Repeat slots",
      version: 1,
      weeks: 1,
      items: [first, second].map((id, i) => ({
        id,
        exercise_id: exerciseId,
        week: 1,
        day: 1,
        target_sets: 2,
        target_reps: i ? "12" : "8",
        position: i,
        name_en: "Bench Press",
        name_ar: null,
        muscle: "chest",
        equipment: "barbell",
        logging_mode: "weighted_reps",
        load_convention: "external_total",
      })),
    },
  ];
  await page.goto("/train");
  await page.getByRole("button", { name: "My program", exact: true }).click();
  await page.getByRole("button", { name: "Start this day", exact: true }).click();
  const a = page.locator(`[data-exercise-slot="${version}:${first}"]`),
    b = page.locator(`[data-exercise-slot="${version}:${second}"]`);
  const one = a.getByRole("group", { name: "Planned set 1", exact: true }),
    two = a.getByRole("group", { name: "Planned set 2", exact: true });
  await one.getByLabel("kg", { exact: true }).fill("50");
  await two.getByLabel("kg", { exact: true }).fill("55");
  await two.getByLabel("Reps", { exact: true }).fill("9");
  await page.reload();
  await expect(one.getByLabel("kg", { exact: true })).toHaveValue("50");
  await expect(two.getByLabel("kg", { exact: true })).toHaveValue("55");
  await page.getByRole("button", { name: "Rest settings", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Seconds", { exact: true }).fill("141");
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Rest", exact: true })).toHaveValue("141");
  await b.getByRole("button", { expanded: false }).click();
  await expect(page.getByRole("combobox", { name: "Rest", exact: true })).toHaveValue("90");
  await page.getByRole("combobox", { name: "Rest", exact: true }).selectOption("60");
  await expect(page.getByRole("combobox", { name: "Rest", exact: true })).toHaveValue("60");
  await a.getByRole("button", { expanded: false }).click();
  await expect(page.getByRole("combobox", { name: "Rest", exact: true })).toHaveValue("141");
  await a.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page
    .getByLabel("Superset partner", { exact: true })
    .selectOption(JSON.stringify([exerciseId, `${version}:${second}`]));
  await page.keyboard.press("Escape");
  await expect(a.getByText("A1 · Superset", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.name === "workouts" && JSON.stringify(args[0]).includes('"weight":"56"')) {
        IDBObjectStore.prototype.put = original;
        throw new DOMException("Device storage is full", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  await two.getByLabel("kg", { exact: true }).fill("56");
  await expect(two.getByRole("alert")).toContainText("Device storage is full");
  await two.getByRole("button", { name: "Complete this set", exact: true }).click();
  await expect(two.getByRole("alert")).toContainText("changed or is not saved");
  expect(backend.tables.set_logs).toHaveLength(0);
  await two.getByLabel("kg", { exact: true }).fill("55");
  await two.getByRole("button", { name: "Complete this set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
  expect(backend.tables.set_logs![0]).toMatchObject({
    reps: 9,
    weight_kg: 55,
    slot_key: `${version}:${first}`,
  });
  await expect(b.getByRole("button", { expanded: true }).first()).toBeVisible();
  const bOne = b.getByRole("group", { name: "Planned set 1", exact: true });
  await bOne.getByLabel("kg", { exact: true }).fill("30");
  await bOne.getByRole("button", { name: "Complete this set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(2);
  expect(backend.tables.set_logs![1]).toMatchObject({
    reps: 12,
    weight_kg: 30,
    slot_key: `${version}:${second}`,
  });
  await expect(one.getByLabel("kg", { exact: true })).toHaveValue("50");
  await expect(page.locator("strong").getByText("1:00", { exact: true })).toBeVisible();
  // The final-seconds treatment follows the actual deadline after adjustments.
  const shorten = page.getByRole("button", { name: "Shorten rest 15 seconds" });
  for (let i = 0; i < 3; i++) await shorten.click();
  await expect(page.locator("[data-rest-final]")).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "Extend rest 15 seconds" }).click();
  await expect(page.locator("[data-rest-final]")).toHaveCount(0);
  await page.reload();
  await expect(a.getByText("A1 · Superset", { exact: true })).toBeVisible();
  await expect(b.getByText("A2 · Superset", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/workout-planned-rows-mobile.png", fullPage: true });
});

test("timed planned rows resume their hold after refresh", async ({ page, context }) => {
  const backend = await fakeBackend(context),
    version = crypto.randomUUID(),
    item = crypto.randomUUID();
  backend.tables.exercises![0] = {
    ...backend.tables.exercises![0],
    name_en: "Plank",
    logging_mode: "timed",
    load_convention: "bodyweight",
    equipment: "bodyweight",
  };
  backend.tables.program_assignments = [
    { id: crypto.randomUUID(), member_id: userId, program_version_id: version, active: true },
  ];
  backend.tables.program_versions = [
    {
      id: version,
      name: "Timed plan",
      version: 1,
      weeks: 1,
      items: [
        {
          id: item,
          exercise_id: exerciseId,
          week: 1,
          day: 1,
          target_sets: 1,
          target_reps: "30",
          position: 0,
          name_en: "Plank",
          name_ar: null,
          muscle: "core",
          equipment: "bodyweight",
          logging_mode: "timed",
          load_convention: "bodyweight",
        },
      ],
    },
  ];
  await page.goto("/train");
  await page.getByRole("button", { name: "My program", exact: true }).click();
  await page.getByRole("button", { name: "Start this day", exact: true }).click();
  const row = page.getByRole("group", { name: "Planned set 1", exact: true });
  await row.getByRole("button", { name: "Start hold", exact: true }).click();
  await page.reload();
  await row.getByRole("button", { name: /^Stop hold/ }).click();
  await expect
    .poll(async () => Number(await row.getByLabel("Seconds", { exact: true }).inputValue()))
    .toBeGreaterThan(0);
  await row.getByRole("button", { name: "Complete this set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
  expect(backend.tables.set_logs![0]).toMatchObject({
    reps: null,
    logging_mode: "timed",
    set_role: "working",
  });
  expect(Number(backend.tables.set_logs![0]!.duration_seconds)).toBeGreaterThan(0);
});

test("late previous performance cannot refill a member-cleared draft after refresh", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await context.route("**/rest/v1/set_logs?**", async (route) => {
    const url = new URL(route.request().url());
    if (
      route.request().method() !== "GET" ||
      !url.searchParams.get("select")?.includes("workout_sessions!inner") ||
      url.searchParams.get("exercise_id") !== `eq.${exerciseId}`
    ) {
      await route.fallback();
      return;
    }
    requested = true;
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "86000000-0000-4000-8000-000000000001",
          session_id: "86000000-0000-4000-8000-000000000002",
          exercise_id: exerciseId,
          reps: 8,
          weight_kg: 70,
          duration_seconds: null,
          slot_key: "",
          created_at: "2026-10-01T10:10:00Z",
          workout_sessions: { finished_at: "2026-10-01T11:00:00Z", origin: "native" },
        },
      ]),
    });
  });
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  await page.getByLabel("Reps", { exact: true }).fill("9");
  await page.getByLabel("kg", { exact: true }).fill("90");
  await page.getByLabel("Reps", { exact: true }).fill("");
  await page.getByLabel("kg", { exact: true }).fill("");
  release();
  await expect(page.getByRole("button", { name: /^Use previous/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /^Use previous/ })).toBeVisible();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("kg", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Add effort (RPE)", exact: true })).toBeVisible();
});

test("previous completed performance remains available after offline refresh", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    session = crypto.randomUUID();
  backend.tables.workout_sessions = [
    {
      id: session,
      member_id: userId,
      title: "Previous workout",
      started_at: "2026-10-01T10:00:00Z",
      finished_at: "2026-10-01T11:00:00Z",
      origin: "native",
    },
  ];
  backend.tables.set_logs = [
    {
      id: crypto.randomUUID(),
      session_id: session,
      member_id: userId,
      exercise_id: exerciseId,
      reps: 8,
      weight_kg: 70,
      duration_seconds: null,
      rpe: 9,
      slot_key: "",
      logging_mode: "weighted_reps",
      load_convention: "external_total",
      set_role: "working",
      side: "bilateral",
      created_at: "2026-10-01T10:10:00Z",
    },
  ];
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Use previous/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add effort (RPE)", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: /Use previous.*Cached on device/ })).toBeVisible();
  await expect(page.getByLabel("kg", { exact: true })).toHaveValue("70");
});

test("exercise thumbnails open GIFs on demand without changing planned drafts", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    version = crypto.randomUUID();
  await trainingFeatures(context, { guidance: true });
  let gifRequests = 0;
  await context.route("https://media.test.invalid/**", async (route) => {
    if (route.request().url().endsWith(".gif")) gifRequests++;
    await route.fulfill({
      contentType: "image/gif",
      body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
    });
  });
  backend.tables.exercises![0] = {
    ...backend.tables.exercises![0],
    editorial_status: "reviewed",
    guidance: { steps_en: "Follow the written setup." },
    media: {
      url: "https://media.test.invalid/bench.gif",
      poster: "https://media.test.invalid/poster.webp",
      author: "Test coach",
      source: "Synthetic test fixture",
      license: "original",
      permission: "Test fixture",
      attribution: "Synthetic test media",
    },
  };
  backend.tables.program_assignments = [
    { id: crypto.randomUUID(), member_id: userId, program_version_id: version, active: true },
  ];
  backend.tables.program_versions = [
    {
      id: version,
      name: "Preview program",
      version: 1,
      weeks: 1,
      items: [
        {
          id: crypto.randomUUID(),
          exercise_id: exerciseId,
          week: 1,
          day: 1,
          position: 0,
          target_sets: 1,
          target_reps: "8",
          name_en: "Frozen Bench",
          name_ar: null,
          muscle: "chest",
          equipment: "barbell",
          logging_mode: "weighted_reps",
          load_convention: "external_total",
        },
      ],
    },
  ];
  await page.goto("/train");
  await page.getByRole("button", { name: "My program", exact: true }).click();
  await expect(page.locator('img[src="https://media.test.invalid/poster.webp"]')).toBeVisible();
  expect(gifRequests).toBe(0);
  await page
    .getByRole("button", { name: "View exercise demonstration: Frozen Bench", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("img", { name: /Demonstration of Frozen Bench/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("[data-workout-session]")).toHaveCount(0);
  await page.getByRole("button", { name: "Start this day", exact: true }).click();
  await page.getByLabel("Reps", { exact: true }).fill("7");
  await page.getByLabel("kg", { exact: true }).fill("50");
  await expect(
    page.locator('[data-workout-session] img[src="https://media.test.invalid/poster.webp"]'),
  ).toBeVisible();
  expect(gifRequests).toBe(1);
  await page
    .getByRole("button", { name: "View exercise demonstration: Frozen Bench", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("img", { name: /Demonstration of Frozen Bench/ }),
  ).toBeVisible();
  // Browsers may reuse the decoded GIF from the program preview.
  expect(gifRequests).toBeGreaterThanOrEqual(1);
  const playedGifRequests = gifRequests;
  await page.getByRole("button", { name: "Stop animation", exact: true }).click();
  await expect(page.getByRole("dialog").locator('img[src$="bench.gif"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByLabel("Reps", { exact: true })).toHaveValue("7");
  await page.reload();
  await expect(
    page.locator('[data-workout-session] img[src="https://media.test.invalid/poster.webp"]'),
  ).toBeVisible();
  await expect(page.getByLabel("kg", { exact: true })).toHaveValue("50");
  expect(gifRequests).toBe(playedGifRequests);
});

test("history details retain all sets and frozen labels with catalogue visuals on demand", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { guidance: true });
  const session = crypto.randomUUID(),
    slot = crypto.randomUUID(),
    hold = crypto.randomUUID();
  const revision = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
  backend.tables.exercises![0]!.guidance = {
    text_source: {
      repository: "hasaneyldrm/exercises-dataset",
      revision,
      exercise_id: "0025",
      license: "MIT",
    },
  };
  backend.tables.workout_sessions = [
    {
      id: session,
      member_id: userId,
      title: "Imported training",
      origin: "import",
      started_at: "2026-09-01T10:00:00Z",
      finished_at: "2026-09-01T11:00:00Z",
    },
  ];
  backend.tables.workout_exercises = [
    {
      id: slot,
      session_id: session,
      member_id: userId,
      exercise_id: exerciseId,
      snapshot: {
        name_en: "Old Bench",
        name_ar: null,
        muscle: "chest",
        equipment: "barbell",
        logging_mode: "weighted_reps",
        load_convention: "per_hand",
      },
    },
    {
      id: hold,
      session_id: session,
      member_id: userId,
      exercise_id: "archived-hold",
      snapshot: {
        name_en: "Old hold",
        muscle: "core",
        equipment: "bodyweight",
        logging_mode: "timed",
        load_convention: "bodyweight",
      },
    },
  ];
  backend.tables.set_logs = [
    ...Array.from({ length: 1001 }, (_, i) => ({
      id: crypto.randomUUID(),
      member_id: userId,
      session_id: session,
      exercise_id: exerciseId,
      workout_exercise_id: slot,
      set_number: i + 1,
      set_role: i ? "working" : "warmup",
      logging_mode: "weighted_reps",
      load_convention: "per_hand",
      side: "bilateral",
      reps: i === 1000 ? 22 : 8,
      weight_kg: 60,
      duration_seconds: null,
      rpe: null,
    })),
    {
      id: crypto.randomUUID(),
      member_id: userId,
      session_id: session,
      exercise_id: "archived-hold",
      workout_exercise_id: hold,
      set_number: 1002,
      set_role: "working",
      logging_mode: "timed",
      load_convention: "bodyweight",
      side: "left",
      duration_seconds: 35,
      reps: null,
      weight_kg: null,
      rpe: 7,
    },
    {
      id: crypto.randomUUID(),
      member_id: "unrelated-member",
      session_id: session,
      exercise_id: exerciseId,
      workout_exercise_id: slot,
      set_number: 1003,
      reps: 88888,
    },
  ];
  let gifRequests = 0,
    failOnce = true;
  await context.route(
    `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${revision}/**`,
    async (route) => {
      if (route.request().url().endsWith(".gif")) gifRequests++;
      await route.fulfill({
        contentType: "image/gif",
        body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
      });
    },
  );
  await context.route("**/rest/v1/set_logs?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("session_id") === `eq.${session}` && failOnce) {
      failOnce = false;
      return route.fulfill({ status: 400, json: { message: "Details temporarily unavailable" } });
    }
    return route.fallback();
  });
  await page.goto("/train");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page
    .getByRole("button", { name: "View workout details: Imported training", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Could not load workout details");
  await page.getByRole("button", { name: "Retry details", exact: true }).click();
  const bench = page.getByRole("region", { name: "Old Bench", exact: true });
  await expect(bench.locator("ol > li")).toHaveCount(1001);
  await expect(bench).toContainText("22 reps · 60 kg");
  await expect(bench).toContainText("Weight per dumbbell / hand");
  await expect(bench.locator('img[src*="/images/0025-"]')).toBeVisible();
  await expect(page.getByRole("region", { name: "Old hold", exact: true })).toContainText("35 sec");
  await expect(page.getByText("88888", { exact: false })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    (await page
      .getByRole("button", { name: "View workout details: Imported training", exact: true })
      .boundingBox())!.width,
  ).toBeGreaterThan(300);
  await page.screenshot({ path: "artifacts/stitch-history-expanded-390.png" });
  expect(gifRequests).toBe(0);
  await bench
    .getByRole("button", { name: "View exercise demonstration: Old Bench", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator('img[src*="/videos/0025-"]')).toBeVisible();
  await expect.poll(() => gifRequests).toBe(1);
  await expect(page.getByRole("dialog")).toContainText("Gym Visual");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(backend.tables.workout_sessions).toHaveLength(1);
});

test("logs offline, survives refresh, syncs retry IDs once, then finishes", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log set", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names)
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    return urls;
  });
  expect(cached.some((url) => url.endsWith("/train"))).toBe(true);
  expect(cached.some((url) => /\/auth\/v1|\/rest\/v1|\/storage\/v1/.test(url))).toBe(false);
  await context.setOffline(true);
  await page.getByLabel("Reps", { exact: true }).fill("5");
  await page.getByLabel("kg", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect(page.getByText(/On device/)).toBeVisible();
  await expect(page.locator('[data-workout-sync-state="pending"]')).toContainText(
    "Offline · Saved on device · waiting to sync",
  );
  await page.reload();
  await expect(page.getByText(/On device/)).toBeVisible();
  await expect(page.locator('[data-workout-sync-state="pending"]')).toBeVisible();
  backend.loseSetResponse();
  await context.setOffline(false);
  await expect.poll(() => backend.setPosts()).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page.getByRole("button", { name: "Retry sync" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Synced", { exact: true })).toBeVisible();
  expect(backend.tables.set_logs).toHaveLength(1);
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await expect(page.locator("[data-stitch-workout-review]")).toContainText("500 kg");
  await page.screenshot({ path: "artifacts/stitch-finish-review.png", fullPage: true });
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start workout", exact: true })).toBeVisible();
  expect(backend.tables.workout_sessions![0]!.finished_at).toBeTruthy();
  await page.screenshot({ path: "test-results/training-mobile.png", fullPage: true });
});

test("calculator warm-up role survives refresh with advanced logging disabled", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { logging: false });
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.getByLabel("kg", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page.getByRole("button", { name: "Plates & warm-up" }).click();
  await page.getByRole("button", { name: "Generate warm-up sets" }).click();
  await page.getByRole("button", { name: "50 kg × 5", exact: true }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Exercise options", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.getByLabel("kg", { exact: true })).toHaveValue("50");
  await page.reload();
  await expect(page.getByLabel("kg", { exact: true })).toHaveValue("50");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
  expect(backend.tables.set_logs![0]!.set_role).toBe("warmup");
  expect(backend.tables.set_logs![0]!.weight_kg).toBe(50);
  expect(backend.tables.set_logs![0]!.reps).toBe(5);
});

test("exercise options stays responsive with the full catalogue and searches every superset partner", async ({
  page,
  context,
}, testInfo) => {
  const backend = await fakeBackend(context);
  backend.tables.exercises!.push(
    ...Array.from({ length: 3000 }, (_, index) => ({
      id: crypto.randomUUID(),
      name_en: `Catalogue ${String(index).padStart(4, "0")}`,
      name_ar: `تمرين ${index}`,
      muscle: "back",
      equipment: "barbell",
      active: true,
    })),
  );
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const started = Date.now();
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Exercise options", exact: true });
  await expect(dialog).toBeVisible({ timeout: 5000 });
  const elapsed = Date.now() - started;
  const partner = dialog.getByLabel("Superset partner", { exact: true });
  await expect(partner.getByRole("option")).toHaveCount(101);
  await dialog.getByLabel("Find superset partner", { exact: true }).fill("Catalogue 2999");
  await expect(partner.getByRole("option")).toHaveCount(2);
  await partner.selectOption({ label: "Catalogue 2999" });
  await expect(partner).not.toHaveValue("");
  // Clearing the filter must retain a selected choice outside the first 100.
  await dialog.getByLabel("Find superset partner", { exact: true }).fill("");
  await expect(partner.locator("option:checked")).toHaveText("Catalogue 2999");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByLabel("kg", { exact: true }).fill("62.5");
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await client.detach();
  await page.reload();
  await expect(page.getByLabel("kg", { exact: true })).toHaveValue("62.5");
  await testInfo.attach("exercise-options-performance", {
    body: JSON.stringify({
      catalogueSize: backend.tables.exercises!.length,
      cpuSlowdown: 4,
      openMilliseconds: elapsed,
      initiallyRenderedChoices: 100,
    }),
    contentType: "application/json",
  });
  writeFileSync(
    "artifacts/exercise-options-performance.json",
    JSON.stringify(
      {
        catalogueSize: backend.tables.exercises!.length,
        cpuSlowdown: 4,
        openMilliseconds: elapsed,
        initiallyRenderedChoices: 100,
      },
      null,
      2,
    ),
  );
});

test("plate math, warmups, swapping and shared superset rest", async ({ page, context }) => {
  await fakeBackend(context);
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.getByLabel("kg", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page.getByRole("button", { name: "Plates & warm-up" }).click();
  await expect(page.getByText("20 + 2 × 40 = 100 kg")).toBeVisible();
  await page.getByRole("button", { name: "Generate warm-up sets" }).click();
  await page.getByRole("button", { name: "50 kg × 5", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("kg", { exact: true })).toHaveValue("50");
  await page.getByLabel("Superset partner").selectOption({ label: "Barbell Row" });
  await page
    .getByRole("dialog", { name: "Exercise options", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Barbell Row/ }).first()).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByLabel("Reps", { exact: true }).fill("5");
  await page.getByLabel("kg", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Bench Press/ }).first()).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("strong").getByText("1:30", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page.getByRole("button", { name: "Swap exercise", exact: true }).click();
  await chooseFromLibrary(page, "Barbell Row");
  await expect(page.getByRole("button", { name: /^Barbell Row/ }).first()).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("native food edits keep their ID and recover deletion across refresh and a lost Undo response", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    id = crypto.randomUUID();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  backend.tables.food_logs = [
    {
      id,
      member_id: userId,
      log_date: day,
      meal: "breakfast",
      name: "Oats",
      calories: 200,
      protein_g: 10,
      carbs_g: 30,
      fat_g: 5,
      revision: 1,
    },
  ];
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Edit Oats", exact: true }).click();
  await page.getByLabel("Calories", { exact: true }).fill("350");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => backend.tables.food_logs![0]!.calories).toBe(350);
  expect(backend.tables.food_logs).toHaveLength(1);
  expect(backend.tables.food_logs![0]!.id).toBe(id);
  await page.getByRole("button", { name: "Delete Oats", exact: true }).click();
  await expect.poll(() => backend.tables.food_logs!.length).toBe(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Undo delete Oats", exact: true })).toBeVisible();
  if (process.env["PW_UI_SCREENSHOTS"]) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "artifacts/nutrition-food-recovery-mobile.png" });
  }
  backend.loseFoodResponse();
  await page.getByRole("button", { name: "Undo delete Oats", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(backend.tables.food_logs).toHaveLength(1);
  await page.getByRole("button", { name: "Undo delete Oats", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Deleted food recovery", exact: true }),
  ).toHaveCount(0);
  expect(backend.tables.food_logs).toHaveLength(1);
  expect(backend.tables.food_logs![0]).toMatchObject({
    id,
    calories: 350,
    revision: 4,
    log_date: day,
  });
});

test("cancelling a food edit restores the unfinished add draft and its validation error", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const id = crypto.randomUUID();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  backend.tables.food_logs = [
    {
      id,
      member_id: userId,
      log_date: day,
      meal: "breakfast",
      name: "Oats",
      calories: 200,
      protein_g: 10,
      carbs_g: 30,
      fat_g: 5,
      revision: 1,
    },
  ];
  await page.goto("/nutrition?entry=quick");
  await page.getByLabel("Food", { exact: true }).fill("Unsaved shake");
  await page.getByLabel("Calories", { exact: true }).fill("bad");
  await page.getByLabel("Protein", { exact: true }).fill("40");
  await page.getByLabel("Portion multiplier", { exact: true }).fill("2");
  await page.getByRole("dialog").getByRole("button", { name: "Add food", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit Oats", exact: true }).click();
  await expect(page.getByLabel("Food", { exact: true })).toHaveValue("Oats");
  await expect(page.getByLabel("Portion multiplier", { exact: true })).toHaveValue("1");
  await page.getByLabel("Calories", { exact: true }).fill("350");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await expect(page.getByLabel("Food", { exact: true })).toHaveValue("Unsaved shake");
  await expect(page.getByLabel("Calories", { exact: true })).toHaveValue("bad");
  await expect(page.getByLabel("Protein", { exact: true })).toHaveValue("40");
  await expect(page.getByLabel("Portion multiplier", { exact: true })).toHaveValue("2");
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(backend.tables.food_logs).toHaveLength(1);
  expect(backend.tables.food_logs![0]).toMatchObject({ id, calories: 200, revision: 1 });
});

test("offline food edit delete and Undo retain one identity before and after acknowledgement", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    id = crypto.randomUUID();
  await trainingFeatures(context, { offline: true });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  backend.tables.food_logs = [
    {
      id,
      member_id: userId,
      log_date: day,
      meal: "breakfast",
      name: "Oats",
      calories: 200,
      protein_g: 10,
      carbs_g: 30,
      fat_g: 5,
      revision: 1,
    },
  ];
  await page.goto("/nutrition");
  await expect(page.getByRole("button", { name: "Edit Oats", exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Edit Oats", exact: true }).click();
  await page.getByLabel("Calories", { exact: true }).fill("350");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Delete Oats", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Undo delete Oats", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Oats", exact: true })).toBeVisible();
  expect(backend.tables.food_logs![0]!.calories).toBe(200);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => backend.tables.food_logs![0]?.revision).toBe(4);
  expect(backend.tables.food_logs).toHaveLength(1);
  expect(backend.tables.food_logs![0]!.id).toBe(id);
  await page.getByRole("button", { name: "Delete Oats", exact: true }).click();
  await expect.poll(() => backend.tables.food_logs!.length).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: "Undo delete Oats", exact: true }).click();
  await expect.poll(() => backend.tables.food_logs![0]?.revision).toBe(6);
  expect(backend.tables.food_logs).toHaveLength(1);
  expect(backend.tables.food_logs![0]).toMatchObject({ id, calories: 350 });
});

test("portions save consumed totals once and offline water Undo survives sync and refresh", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    id = crypto.randomUUID(),
    day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  await trainingFeatures(context, { offline: true });
  backend.tables.water_logs = [{ id, member_id: userId, log_date: day, ml: 250, revision: 1 }];
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Add food", exact: true }).first().click();
  await page.getByRole("button", { name: "Quick macros", exact: true }).click();
  await page.getByLabel("Food", { exact: true }).fill("Portioned oats");
  await page.getByLabel("Calories", { exact: true }).fill("200");
  await page.getByLabel("Protein", { exact: true }).fill("10");
  await page.getByLabel("Portion multiplier", { exact: true }).fill("2");
  const portionSummary = page
    .getByRole("dialog")
    .getByRole("status")
    .filter({ hasText: "Total to save" });
  await expect(portionSummary).toContainText("400 kcal");
  await page.getByLabel("Portion multiplier", { exact: true }).fill("1.5");
  await expect(portionSummary).toContainText("300 kcal");
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/nutrition-portions-mobile.png" });
  await page.getByRole("dialog").getByRole("button", { name: "Add food", exact: true }).click();
  await expect.poll(() => backend.tables.food_logs?.[0]?.calories).toBe(300);
  await page.getByRole("button", { name: "Edit Portioned oats", exact: true }).click();
  await expect(page.getByLabel("Portion multiplier", { exact: true })).toHaveValue("1");
  await expect(page.getByLabel("Calories", { exact: true })).toHaveValue("300");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Add food", exact: true }).first().click();
  await page.getByRole("button", { name: "Quick macros", exact: true }).click();
  await page.getByLabel("Food", { exact: true }).fill("Portion favorite");
  await page.getByLabel("Calories", { exact: true }).fill("100");
  await page.getByLabel("Portion multiplier", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await page.getByRole("button", { name: "Save custom food", exact: true }).click();
  await expect.poll(() => backend.tables.saved_meals?.length).toBe(1);
  expect(backend.tables.saved_meals[0]).toMatchObject({ items: [{ calories: 200 }] });
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Manage water entries", exact: true }).click();
  await page.getByRole("button", { name: "Edit water entry 1", exact: true }).click();
  await page.getByLabel("Water amount (ml)", { exact: true }).fill("750");
  await page.getByRole("button", { name: "Save water changes", exact: true }).click();
  await page.getByRole("button", { name: "Delete water entry 1", exact: true }).click();
  // A click starts an asynchronous IndexedDB transaction; only reload after the
  // recovery action confirms that its deletion and Undo record were persisted.
  await expect(
    page.getByRole("button", { name: "Undo water deletion 750 ml", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Manage water entries (1)", exact: true }).click();
  await page.getByRole("button", { name: "Undo water deletion 750 ml", exact: true }).click();
  expect(backend.tables.water_logs[0]!.ml).toBe(250);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => backend.tables.water_logs[0]?.revision).toBe(4);
  await page.getByRole("button", { name: "Delete water entry 1", exact: true }).click();
  await expect.poll(() => backend.tables.water_logs.length).toBe(0);
  // Server deletion can finish before the local recovery receipt is committed.
  await expect(
    page.getByRole("button", { name: "Undo water deletion 750 ml", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Manage water entries (1)", exact: true }).click();
  await page.getByRole("button", { name: "Undo water deletion 750 ml", exact: true }).click();
  await expect.poll(() => backend.tables.water_logs[0]?.revision).toBe(6);
  expect(backend.tables.water_logs).toHaveLength(1);
  expect(backend.tables.water_logs[0]).toMatchObject({ id, ml: 750 });
});

test("native water edits retain invalid values and lost Undo acknowledgements cannot duplicate entries", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    id = crypto.randomUUID(),
    day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  backend.tables.water_logs = [{ id, member_id: userId, log_date: day, ml: 250, revision: 1 }];
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Manage water entries", exact: true }).click();
  await page.getByRole("button", { name: "Edit water entry 1", exact: true }).click();
  await page.getByLabel("Water amount (ml)", { exact: true }).fill("-5");
  await page.getByRole("button", { name: "Save water changes", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Water amount (ml)", { exact: true })).toHaveValue("-5");
  await page.getByLabel("Water amount (ml)", { exact: true }).fill("600");
  await page.getByRole("button", { name: "Save water changes", exact: true }).click();
  await expect.poll(() => backend.tables.water_logs[0]!.ml).toBe(600);
  await page.getByRole("button", { name: "Delete water entry 1", exact: true }).click();
  await expect.poll(() => backend.tables.water_logs.length).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: "Manage water entries (1)", exact: true }).click();
  backend.loseWaterResponse();
  if (process.env["PW_UI_SCREENSHOTS"]) {
    await expect(page.getByRole("dialog")).toBeInViewport({ ratio: 0.99 });
    await page.screenshot({ path: "artifacts/water-recovery-mobile.png", animations: "disabled" });
  }
  await page.getByRole("button", { name: "Undo water deletion 600 ml", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Undo water deletion 600 ml", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Deleted water recovery", exact: true }),
  ).toHaveCount(0);
  expect(backend.tables.water_logs).toHaveLength(1);
  expect(backend.tables.water_logs[0]).toMatchObject({ id, ml: 600, revision: 4 });
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 794 });
  await page.getByRole("button", { name: "إدارة سجلات المياه", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("dialog")).toBeInViewport({ ratio: 0.99 });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({
      path: "artifacts/water-entries-ar-mobile.png",
      animations: "disabled",
    });
});

test("measurement sheets retain dates and drafts and reconcile a lost native acknowledgement", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    day = "2026-10-20";
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/progress?section=body");
  await expect(page.getByLabel("Weight kg", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add measurements", exact: true }).click();
  await page.getByLabel("Measurement date · Cairo", { exact: true }).fill(day);
  await page.getByLabel("Weight kg", { exact: true }).fill("81.5");
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Photos", exact: true }).click();
  await page.goBack();
  await page.getByRole("button", { name: "Add measurements", exact: true }).click();
  await expect(page.getByLabel("Weight kg", { exact: true })).toHaveValue("81.5");
  await expect(page.getByLabel("Measurement date · Cairo", { exact: true })).toHaveValue(day);
  backend.loseBodyResponse();
  await page.getByRole("button", { name: "Save measurement", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Weight kg", { exact: true })).toHaveValue("81.5");
  await page.getByRole("button", { name: "Save measurement", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(backend.tables.body_measurements).toHaveLength(1);
  expect(backend.tables.body_measurements[0]).toMatchObject({ measured_on: day, weight_kg: 81.5 });
  await expect(
    page.getByRole("region", { name: "Measurement history", exact: true }),
  ).toContainText(day);
  await page.getByRole("button", { name: "Add measurements", exact: true }).click();
  await page.getByLabel("Weight kg", { exact: true }).fill("82");
  const preferences = await context.newPage();
  await preferences.goto("/profile?section=preferences");
  await expect(preferences.getByLabel("Display name", { exact: true })).toHaveValue("Test Athlete");
  await preferences.getByLabel("Units", { exact: true }).selectOption("imperial");
  await preferences.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => backend.tables.profiles[0]!.units).toBe("imperial");
  await expect(preferences.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("th").filter({ hasText: "Weight (lb)" })).toHaveCount(1);
  await expect(page.getByLabel("Weight kg", { exact: true })).toHaveValue("82");
  await preferences.close();
  if (process.env["PW_UI_SCREENSHOTS"]) {
    await expect(page.getByRole("dialog")).toBeInViewport({ ratio: 0.99 });
    await page.screenshot({
      path: "artifacts/measurement-sheet-mobile.png",
      animations: "disabled",
    });
  }
});

for (const locale of ["en", "ar"] as const) {
  test(`Phase 3 and 4 enhancements convert servings and preserve community drafts in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale),
      l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await trainingFeatures(context, { social: true });
    backend.tables.foods = [
      {
        id: crypto.randomUUID(),
        name_en: "Metric oats",
        name_ar: "شوفان",
        serving: "100 g",
        calories: 200,
        protein_g: 10,
        carbs_g: 30,
        fat_g: 5,
        active: true,
      },
    ];
    backend.tables.member_pv_totals = [{ member_id: userId, points: 100 }];
    backend.tables.rewards = [
      {
        id: crypto.randomUUID(),
        title_en: "Affordable reward",
        title_ar: "مكافأة متاحة",
        cost_pv: 50,
        stock: 2,
        active: true,
      },
      {
        id: crypto.randomUUID(),
        title_en: "Expensive reward",
        title_ar: "مكافأة مرتفعة",
        cost_pv: 200,
        stock: 2,
        active: true,
      },
    ];
    await context.route("**/rest/v1/rpc/social_action", (route) =>
      route.fulfill({
        json: {
          account: {
            member_id: userId,
            code: "PF-1234567890ABCDEF",
            discoverable: true,
            sharing: true,
          },
          friends: [],
          blocked: [],
          challenges: [],
        },
      }),
    );
    await page.goto("/nutrition");
    await page.getByRole("button", { name: l("Add food", "إضافة طعام"), exact: true }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: l("Search", "بحث"), exact: true }).click();
    await sheet
      .getByRole("textbox", { name: l("Search foods…", "ابحث عن طعام…"), exact: true })
      .fill("Metric");
    await sheet.getByRole("button", { name: /Metric oats|شوفان/ }).click();
    await sheet.getByLabel(l("Amount unit", "وحدة الكمية"), { exact: true }).selectOption("g");
    await sheet.getByLabel(l("Amount (g)", "الكمية (g)"), { exact: true }).fill("50");
    await sheet.screenshot({ path: `artifacts/phase34-food-entry-${locale}.png` });
    await sheet.getByRole("button", { name: l("Add food", "إضافة طعام"), exact: true }).click();
    await expect.poll(() => backend.tables.food_logs.length).toBe(1);
    expect(backend.tables.food_logs[0]!.calories).toBe(100);
    await page.getByRole("button", { name: l("Add food", "إضافة طعام"), exact: true }).click();
    await expect(
      page.getByRole("region", { name: l("Quick recent foods", "أطعمة حديثة سريعة") }),
    ).toContainText("100 kcal");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: l("Close", "إغلاق"), exact: true })
      .click();
    await page.goto("/rewards?section=shop");
    await page.getByLabel(l("Within my PV balance", "ضمن رصيدي من PV"), { exact: true }).check();
    await expect(
      page.getByText(l("Expensive reward", "مكافأة مرتفعة"), { exact: true }),
    ).toHaveCount(0);
    await page.getByLabel(l("Find a reward", "البحث عن مكافأة"), { exact: true }).fill("no-match");
    await expect(
      page.getByRole("button", {
        name: l("Clear reward filters", "مسح فلاتر المكافآت"),
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: l("Community", "المجتمع"), exact: true }).click();
    await page.getByRole("button", { name: l("Challenges", "التحديات"), exact: true }).click();
    await page
      .getByLabel(l("Challenge title", "عنوان التحدي"), { exact: true })
      .fill("Unfinished challenge");
    await page.getByRole("button", { name: l("Friends", "الأصدقاء"), exact: true }).click();
    await expect(
      page.getByLabel(l("Challenge title", "عنوان التحدي"), { exact: true }),
    ).toBeHidden();
    await page.goBack();
    await expect(
      page.getByLabel(l("Challenge title", "عنوان التحدي"), { exact: true }),
    ).toHaveValue("Unfinished challenge");
    await page.setViewportSize({ width: 320, height: 844 });
    await expectAlignedControls(page);
    await page.screenshot({ path: `artifacts/phase34-community-${locale}.png`, fullPage: true });
  });
}

test("Phase 3 meal copy reviews first and retries stable IDs after a lost native acknowledgement", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  backend.tables.food_logs = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      log_date: "2026-10-01",
      meal: "breakfast",
      name: "Source oats",
      calories: 400,
      protein_g: 20,
      carbs_g: 60,
      fat_g: 10,
    },
  ];
  let fail = true;
  const sent: string[][] = [];
  await context.route("**/rest/v1/food_logs**", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const rows = route.request().postDataJSON() as Row[];
    sent.push(rows.map((row) => String(row.id)));
    for (const row of rows)
      if (!backend.tables.food_logs.some((saved) => saved.id === row.id))
        backend.tables.food_logs.push(row);
    return fail ? route.abort("failed") : route.fulfill({ json: rows });
  });
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Copy a previous meal", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review meal copy", exact: true });
  await review.getByLabel("Source date", { exact: true }).fill("2026-10-01");
  await review.getByRole("button", { name: "Preview meal", exact: true }).click();
  await expect(review.getByText("Source oats · 400 kcal", { exact: true })).toBeVisible();
  expect(sent).toHaveLength(0);
  await review.getByLabel("Copy portion multiplier", { exact: true }).fill("0.5");
  await review.screenshot({ path: "artifacts/phase34-meal-copy.png" });
  await review.getByRole("button", { name: "Confirm meal copy", exact: true }).click();
  await expect(review.getByRole("button", { name: "Retry saved copy", exact: true })).toBeVisible();
  fail = false;
  await page.reload();
  const recovered = page.getByRole("dialog", { name: "Review meal copy", exact: true });
  await recovered.getByRole("button", { name: "Retry saved copy", exact: true }).click();
  await expect(recovered).toBeHidden();
  expect(sent.length).toBeGreaterThanOrEqual(2);
  expect(sent.every((ids) => JSON.stringify(ids) === JSON.stringify(sent[0]))).toBe(true);
  const copies = backend.tables.food_logs.filter((row) => row.log_date === day);
  expect(copies).toHaveLength(1);
  expect(copies[0]!.calories).toBe(200);
  expect(copies[0]!.id).not.toBe(backend.tables.food_logs[0]!.id);
});

test("Phase 3 copied meals remain atomic across offline reload and sync", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { offline: true });
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  backend.tables.food_logs = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      log_date: day,
      meal: "breakfast",
      name: "Cached meal",
      calories: 400,
      protein_g: 20,
      carbs_g: 60,
      fat_g: 10,
      revision: 1,
    },
  ];
  await page.goto("/nutrition");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.getByText("Cached meal", { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Copy a previous meal", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review meal copy", exact: true });
  await review.getByLabel("Source date", { exact: true }).fill(day);
  await review.getByRole("button", { name: "Preview meal", exact: true }).click();
  await review.getByLabel("Copy portion multiplier", { exact: true }).fill("0.5");
  await review.getByRole("button", { name: "Confirm meal copy", exact: true }).click();
  await expect(review).toBeHidden();
  await page.reload();
  await expect(page.locator("[data-stitch-nutrition-summary]")).toContainText("600");
  await expect(
    page.locator("[data-food-save-state]").filter({ hasText: "waiting to sync" }),
  ).toHaveCount(1);
  expect(backend.tables.food_logs).toHaveLength(1);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => backend.tables.food_logs.length, { timeout: 20000 }).toBe(2);
  expect(new Set(backend.tables.food_logs.map((row) => row.id)).size).toBe(2);
});

test("Phase 4 muscle starting points preview guidance and respect equipment filters", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { guidance: true, logging: true });
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  const picker = page.locator("[data-stitch-exercise-picker]");
  await picker.getByRole("button", { name: "Browse by muscle", exact: true }).click();
  await picker
    .getByRole("group", { name: "Muscle", exact: true })
    .getByRole("button", { name: "Chest", exact: true })
    .click();
  const suggestions = picker.getByRole("region", { name: "Muscle starting points", exact: true });
  await expect(suggestions.getByRole("button", { name: "Bench Press", exact: true })).toBeVisible();
  await suggestions.getByRole("button", { name: "Bench Press", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bench Press", exact: true })).toBeVisible();
  await page.getByRole("dialog").last().getByRole("button", { name: "Close", exact: true }).click();
  await picker
    .getByRole("group", { name: "Equipment", exact: true })
    .getByRole("button", { name: "Barbell", exact: true })
    .click();
  await expect(suggestions.getByRole("button", { name: "Bench Press", exact: true })).toBeVisible();
  await picker
    .getByRole("searchbox", { name: "Search exercises", exact: true })
    .fill("Barbell Row");
  await expect(suggestions).toHaveCount(0);
  await page.screenshot({ path: "artifacts/phase4-muscle-discovery.png" });
  expect(backend.tables.set_logs).toHaveLength(0);
});

for (const locale of ["en", "ar"] as const) {
  test(`Phase 4 progress rewards and community remain accurate and responsive in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    await trainingFeatures(context, { social: true });
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    backend.tables.member_pv_totals = [{ member_id: userId, points: 125 }];
    backend.tables.body_measurements = [
      {
        id: crypto.randomUUID(),
        member_id: userId,
        measured_on: "2026-11-01",
        weight_kg: 80,
        waist_cm: null,
        body_fat_pct: null,
      },
    ];
    backend.tables.rewards = [
      {
        id: crypto.randomUUID(),
        title_en: "Recovery session",
        title_ar: "جلسة تعافٍ",
        cost_pv: 50,
        stock: 2,
        active: true,
      },
    ];
    backend.tables.badges = [
      {
        code: "first",
        title_en: "First session",
        title_ar: "الجلسة الأولى",
        description_en: "Complete a workout",
        description_ar: "أكمل تمريناً",
        xp_bonus: 100,
        position: 1,
      },
    ];
    const ops: string[] = [];
    await context.route("**/rest/v1/rpc/social_action", (route) => {
      ops.push(route.request().postDataJSON()._op);
      return route.fulfill({
        json: {
          account: {
            member_id: userId,
            code: "PF-1234567890ABCDEF",
            discoverable: false,
            sharing: false,
          },
          friends: [],
          blocked: [],
          challenges: [],
        },
      });
    });
    await page.goto("/progress");
    await expect(page.locator("[data-stitch-progress-metrics] dd").first()).toHaveText("0");
    await expect(
      page.getByText(l("Front view", "الواجهة الأمامية"), { exact: true }),
    ).toBeVisible();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expectAlignedControls(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `artifacts/phase4-progress-${locale}.png`, fullPage: true });
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const spacing = await page.locator("[data-stitch-muscle-volume]").evaluate((section) => {
        const disclosure = section
          .querySelector("[data-muscle-breakdown]")!
          .getBoundingClientRect();
        const controls = section.querySelector("[data-muscle-controls]")!;
        const style = getComputedStyle(controls);
        return {
          vertical: controls.getBoundingClientRect().top - disclosure.bottom,
          row: parseFloat(style.rowGap),
          column: parseFloat(style.columnGap),
        };
      });
      expect(spacing.vertical).toBeGreaterThanOrEqual(16);
      expect(spacing.row).toBeGreaterThanOrEqual(12);
      expect(spacing.column).toBeGreaterThanOrEqual(12);
      await expectAlignedControls(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("[data-stitch-muscle-volume]").screenshot({
      path: `artifacts/spacing-muscle-volume-${locale}.png`,
      // Exclude fixed navigation from the stitched component-only review capture.
      style:
        '[data-studio-shell] > a[href="#main-content"], [data-studio-shell] > nav { visibility: hidden !important; }',
    });
    const session = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    backend.tables.workout_sessions = [
      {
        id: session,
        member_id: userId,
        title: "Imported strength",
        started_at: timestamp,
        finished_at: timestamp,
        origin: "import",
      },
    ];
    backend.tables.set_logs = [
      {
        id: crypto.randomUUID(),
        member_id: userId,
        session_id: session,
        exercise_id: exerciseId,
        reps: 5,
        weight_kg: 100,
        load_convention: "external_total",
        logging_mode: "weighted_reps",
        set_role: "working",
        side: "bilateral",
        created_at: timestamp,
      },
    ];
    await page.getByRole("button", { name: l("Strength", "القوة"), exact: true }).click();
    await expect(page.getByText("100 kg × 5", { exact: true })).toBeVisible();
    await expectAlignedControls(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/phase4-strength-${locale}.png`, fullPage: true });
    await page.getByRole("button", { name: l("Body", "الجسم"), exact: true }).click();
    await expect(page.locator("[data-stitch-body-metrics]")).toContainText("80");
    await expect(page.locator("[data-stitch-body-metrics]")).toContainText(
      l("Not recorded", "لم يُسجّل"),
    );
    await expectAlignedControls(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/phase4-body-${locale}.png`, fullPage: true });
    await page.goto("/rewards");
    await expect(page.locator("[data-stitch-reward-summary]")).toContainText(
      (125).toLocaleString(locale),
    );
    await expect(
      page.getByRole("button", { name: l("Level 91 Locked", "المستوى 91 مقفل"), exact: true }),
    ).toBeVisible();
    await expectAlignedControls(page);
    await page.screenshot({ path: `artifacts/phase4-journey-${locale}.png`, fullPage: true });
    await page
      .getByRole("button", { name: l("Reward shop", "متجر المكافآت"), exact: true })
      .click();
    await expect(
      page.getByText(l("Recovery session", "جلسة تعافٍ"), { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: l("Redeem", "استبدال"), exact: true }),
    ).toBeEnabled();
    await page.screenshot({ path: `artifacts/phase4-shop-${locale}.png`, fullPage: true });
    await page.getByRole("button", { name: l("Community", "المجتمع"), exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: l("Community destinations", "وجهات المجتمع") }),
    ).toBeVisible();
    await page
      .getByRole("combobox", {
        name: l("Leaderboard & activity by Pod", "الصدارة والنشاط حسب المجموعة"),
      })
      .selectOption("pod");
    await expect(page.getByText("Coach Tarek", { exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/phase4-community-${locale}.png`, fullPage: true });
    await page.getByRole("button", { name: l("Friends", "الأصدقاء"), exact: true }).click();
    await expect(page.getByText("PF-1234567890ABCDEF", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: l("Challenges", "التحديات"), exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: l("Create a shared challenge", "إنشاء تحدٍ مشترك"),
        exact: true,
      }),
    ).toBeVisible();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expectAlignedControls(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/phase4-challenges-${locale}.png`, fullPage: true });
    expect(ops.every((op) => op === "state")).toBe(true);
    expect(backend.tables.redemptions ?? []).toHaveLength(0);
  });
}

test("Phase 4 unavailable reward and Pod reads never claim maximum rank or empty membership", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  await context.route("**/rest/v1/member_xp_totals**", (route) =>
    route.fulfill({ status: 503, json: { message: "Totals unavailable" } }),
  );
  let fail = true;
  await context.route("**/rest/v1/pods**", (route) =>
    fail ? route.fulfill({ status: 403, json: { message: "Pods unavailable" } }) : route.fallback(),
  );
  await page.goto("/rewards?section=community");
  await expect(page.locator("[data-stitch-reward-summary]")).toContainText("Progress unavailable");
  await expect(page.locator("[data-stitch-reward-summary]")).not.toContainText("Max level");
  await expect(page.getByRole("button", { name: "Retry Pod activity", exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByText("Your leader will assign you to a Pod.", { exact: true }),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry Pod activity", exact: true }).click();
  await expect(
    page
      .getByRole("combobox", { name: "Leaderboard & activity by Pod" })
      .getByRole("option", { name: "Test Pod", exact: true }),
  ).toHaveCount(1);
});

test("strength metrics separate load conventions and show imported source sets", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    native = crypto.randomUUID(),
    imported = crypto.randomUUID(),
    when = new Date().toISOString();
  backend.tables.workout_sessions = [
    {
      id: native,
      member_id: userId,
      title: "Total-load day",
      started_at: when,
      finished_at: when,
      origin: "native",
    },
    {
      id: imported,
      member_id: userId,
      title: "Imported dumbbells",
      started_at: when,
      finished_at: when,
      activity_date: "2026-10-20",
      origin: "import",
    },
  ];
  backend.tables.set_logs = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      session_id: native,
      exercise_id: exerciseId,
      reps: 5,
      weight_kg: 100,
      load_convention: "external_total",
      logging_mode: "weighted_reps",
      set_role: "working",
      side: "bilateral",
      created_at: when,
    },
    {
      id: crypto.randomUUID(),
      member_id: userId,
      session_id: imported,
      exercise_id: exerciseId,
      reps: 8,
      weight_kg: 30,
      load_convention: "per_hand",
      logging_mode: "weighted_reps",
      set_role: "working",
      side: "bilateral",
      created_at: when,
    },
  ];
  await page.goto("/progress?section=strength");
  await page.getByText("More strength filters", { exact: true }).click();
  await page.getByLabel("Record load convention", { exact: true }).selectOption("external_total");
  await expect(page.getByText("100 kg × 5", { exact: true })).toBeVisible();
  await page.getByLabel("Record load convention", { exact: true }).selectOption("per_hand");
  await expect(page.getByText("30 kg × 8", { exact: true })).toBeVisible();
  await expect(page.getByText("100 kg × 5", { exact: true })).toHaveCount(0);
  const exerciseSearch = page.getByLabel("Search strength exercises", { exact: true });
  await exerciseSearch.fill("No matching exercise");
  await expect(exerciseSearch).toBeFocused();
  await exerciseSearch.pressSequentially(" still typing");
  await expect(exerciseSearch).toHaveValue("No matching exercise still typing");
  await exerciseSearch.fill("");
  await page.getByText("Review source sets (2)", { exact: true }).click();
  await expect(page.getByText("Imported · no rewards", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Imported dumbbells", exact: true })).toHaveAttribute(
    "href",
    new RegExp(`session=${imported}`),
  );
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/strength-evidence-mobile.png" });
});

test("coach sections defer private reads, expand every set and block former coaches", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    member = crypto.randomUUID(),
    session = crypto.randomUUID(),
    now = new Date().toISOString(),
    day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  backend.tables.profiles.push({
    id: member,
    display_name: "Coached member",
    email: "coached@test.invalid",
    access_active: true,
    units: "metric",
    locale: "en",
  });
  backend.tables.workout_sessions = [
    {
      id: session,
      member_id: member,
      title: "Complete leg day",
      started_at: now,
      finished_at: now,
      origin: "native",
    },
  ];
  backend.tables.workout_exercises = Array.from({ length: 8 }, (_, i) => ({
    id: crypto.randomUUID(),
    snapshot: { name_en: `Frozen exercise ${i + 1}`, name_ar: null },
  }));
  backend.tables.set_logs = backend.tables.workout_exercises.map((slot) => ({
    id: crypto.randomUUID(),
    member_id: member,
    session_id: session,
    exercise_id: exerciseId,
    workout_exercise_id: slot.id,
    reps: 8,
    weight_kg: 40,
    created_at: now,
    set_role: "working",
    side: "bilateral",
  }));
  backend.tables.food_logs = [
    { id: crypto.randomUUID(), member_id: member, log_date: day, calories: 750, protein_g: 50 },
  ];
  const privateReads: string[] = [];
  context.on("request", (request) => {
    if (
      request.method() === "GET" &&
      /\/(food_logs|body_measurements|progress_photos)(\?|$)/.test(request.url())
    )
      privateReads.push(request.url());
  });
  await page.goto(`/members/${member}`);
  await expect(
    page.getByRole("navigation", { name: "Member workspace sections", exact: true }),
  ).toBeVisible();
  expect(privateReads).toEqual([]);
  await page.screenshot({ path: "artifacts/phase6-member-overview.png", animations: "disabled" });
  await page.getByRole("button", { name: "Review training history", exact: true }).click();
  await page.getByRole("button", { name: "View sets · Complete leg day", exact: true }).click();
  await expect(page.getByText("Frozen exercise 8", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(
    page.getByText("Averages use logged days only. Missing days are not zero-intake days.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("750", { exact: true })).toBeVisible();
  expect(privateReads.some((url) => url.includes("food_logs"))).toBe(true);
  expect(privateReads.some((url) => url.includes("progress_photos"))).toBe(false);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/coach-member-nutrition-mobile.png" });
  backend.tables.user_roles = [{ user_id: userId, role: "coach" }];
  backend.tables.coach_assignments = [];
  privateReads.length = 0;
  await page.reload();
  await expect(
    page.getByText(
      "This workspace is available to the member's current assigned coach and active administrators.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(privateReads).toEqual([]);
});

test("coach roster searches beyond REST caps and reads complete XP and visible workout summaries", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    target = crypto.randomUUID(),
    when = new Date().toISOString(),
    day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  backend.tables.user_roles = [{ user_id: userId, role: "coach" }];
  const members = Array.from({ length: 1005 }, (_, i) => ({
    id: i === 1004 ? target : crypto.randomUUID(),
    display_name: i === 1004 ? "Zed Target" : `Member ${String(i).padStart(4, "0")}`,
    email: `roster-${i}@test.invalid`,
    access_active: true,
    units: "metric",
    locale: "en",
  }));
  backend.tables.profiles.push(...members);
  backend.tables.coach_assignments = members.map((member) => ({
    id: crypto.randomUUID(),
    coach_id: userId,
    member_id: member.id,
    active: true,
  }));
  backend.tables.member_xp_totals = [
    { member_id: userId, xp: 300 },
    { member_id: target, xp: 900000 },
  ];
  backend.tables.workout_sessions = Array.from({ length: 1005 }, () => ({
    id: crypto.randomUUID(),
    member_id: target,
    title: "Complete session",
    started_at: when,
    finished_at: when,
    activity_date: null,
    origin: "native",
  }));
  backend.tables.workout_sessions.push(
    {
      id: crypto.randomUUID(),
      member_id: target,
      title: "Older imported day",
      started_at: when,
      finished_at: when,
      activity_date: "2026-09-01",
      origin: "import",
    },
    {
      id: crypto.randomUUID(),
      member_id: target,
      title: "Unfinished",
      started_at: when,
      finished_at: null,
    },
  );
  const sessionReads: string[] = [];
  context.on("request", (request) => {
    if (request.method() === "GET" && request.url().includes("/rest/v1/workout_sessions"))
      sessionReads.push(request.url());
  });
  await page.goto("/members");
  await expect(
    page.getByText("1005 matching members · names sorted alphabetically", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search members", { exact: true }).fill("Zed Target");
  await page.getByRole("button", { name: "Apply member search", exact: true }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Zed Target" });
  await expect(row).toContainText("900000 XP");
  await expect(row.getByRole("definition").filter({ hasText: /^1005$/ })).toBeVisible();
  await expect(row).toContainText(day);
  expect(sessionReads.every((url) => new URL(url).searchParams.get("limit") === "1")).toBe(true);
  await page.reload();
  await expect(page.getByLabel("Search members", { exact: true })).toHaveValue("Zed Target");
  await page.getByRole("combobox", { name: "Relationship", exact: true }).selectOption("pod");
  await expect(page.getByText("No members match these filters.", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("listitem").filter({ hasText: "Zed Target" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 850 });
  await expect(page.getByRole("row").filter({ hasText: "Zed Target" })).toContainText("900000 XP");
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/coach-roster-mobile.png" });
});

test("coach policy drafts stay per slot, preserve overrides and refuse stale revisions", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    assignment = crypto.randomUUID(),
    version = crypto.randomUUID(),
    first = crypto.randomUUID(),
    second = crypto.randomUUID();
  await trainingFeatures(context, { progression: true, scheduling: true });
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  const item = {
    exercise_id: exerciseId,
    week: 1,
    day: 1,
    target_sets: 3,
    target_reps: "8-12",
    position: 0,
    name_en: "Bench Press",
    name_ar: null,
    muscle: "chest",
    equipment: "barbell",
  };
  const items = [
    { ...item, id: first },
    { ...item, id: second, target_sets: 5, position: 1 },
  ];
  backend.tables.program_assignments = [
    { id: assignment, member_id: userId, program_version_id: version, active: true },
  ];
  backend.tables.program_versions = [
    { id: version, name: "Reviewed program", version: 1, weeks: 1, items },
  ];
  backend.tables.program_schedules = [
    { assignment_id: assignment, member_id: userId, mode: "rotation", start_date: "2026-10-20" },
  ];
  backend.tables.training_policies = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      program_version_id: version,
      slot_key: `${version}:${first}`,
      exercise_id: exerciseId,
      rule: "double",
      working_sets: 3,
      reps_min: 8,
      reps_max: 12,
      duration_target: null,
      increment: 2.5,
      rpe_ceiling: 8,
      upper_limit: null,
      allow_imported: false,
      revision: 1,
      updated_at: "2026-10-20T12:00:00Z",
      override: { reason: "Keep this target", weight_kg: 30, reps: 10, duration_seconds: null },
    },
  ];
  await page.goto(`/members/${userId}?section=training`);
  await expect(page.getByLabel("Schedule mode", { exact: true })).toHaveValue("rotation");
  await expect(page.getByLabel("Program day one", { exact: true })).toHaveValue("2026-10-20");
  await page
    .getByRole("combobox", { name: "Program exercise slot", exact: true })
    .selectOption(first);
  await page.getByLabel("Working sets", { exact: true }).fill("4");
  await page
    .getByRole("combobox", { name: "Program exercise slot", exact: true })
    .selectOption(second);
  await page.getByLabel("Progression rule", { exact: true }).selectOption("double");
  await expect(page.getByLabel("Working sets", { exact: true })).toHaveValue("5");
  await page.getByLabel("RPE ceiling", { exact: true }).fill("7");
  await page
    .getByRole("combobox", { name: "Program exercise slot", exact: true })
    .selectOption(first);
  await expect(page.getByLabel("Working sets", { exact: true })).toHaveValue("4");
  await page.getByRole("button", { name: "Save progression policy", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Test Athlete");
  if (process.env["PW_UI_SCREENSHOTS"]) {
    await expect(page.getByRole("dialog")).toBeInViewport({ ratio: 0.99 });
    await page.screenshot({
      path: "artifacts/coach-policy-review-mobile.png",
      animations: "disabled",
    });
  }
  expect(backend.tables.training_policies[0]!.working_sets).toBe(3);
  await page.getByRole("button", { name: "Confirm coaching changes", exact: true }).click();
  await expect.poll(() => backend.tables.training_policies[0]!.working_sets).toBe(4);
  expect(backend.tables.training_policies[0]!.override).toMatchObject({
    reason: "Keep this target",
    issued_at: "2026-10-20T12:00:00Z",
  });
  await expect(page.getByText(/Progression policy saved/)).toBeVisible();
  await page
    .getByRole("combobox", { name: "Program exercise slot", exact: true })
    .selectOption(second);
  await expect(page.getByLabel("RPE ceiling", { exact: true })).toHaveValue("7");
  await page
    .getByRole("combobox", { name: "Program exercise slot", exact: true })
    .selectOption(first);
  await page.getByLabel("RPE ceiling", { exact: true }).fill("9");
  backend.tables.training_policies[0]!.revision = 3;
  await page.getByRole("button", { name: "Save progression policy", exact: true }).click();
  await page.getByRole("button", { name: "Confirm coaching changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("changed");
  await expect(page.getByLabel("RPE ceiling", { exact: true })).toHaveValue("9");
  expect(backend.tables.training_policies[0]!.rpe_ceiling).toBe(8);
  expect(backend.tables.program_versions[0]!.items).toEqual(items);
  await page
    .getByRole("combobox", { name: "Program exercise slot", exact: true })
    .selectOption(second);
  await page.getByLabel("Load increment (kg)", { exact: true }).fill("invalid");
  await page.getByLabel("Progression rule", { exact: true }).selectOption("off");
  await page.getByRole("button", { name: "Save progression policy", exact: true }).click();
  await page.getByRole("button", { name: "Confirm coaching changes", exact: true }).click();
  await expect.poll(() => backend.tables.training_policies.length).toBe(2);
  expect(backend.tables.training_policies[1]).toMatchObject({
    rule: "off",
    working_sets: 5,
    increment: 2.5,
  });
  await page
    .getByRole("combobox", { name: "Program exercise slot", exact: true })
    .selectOption(first);
  await page.getByRole("button", { name: "Reload controls", exact: true }).click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("RPE ceiling", { exact: true })).toHaveValue("9");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 794 });
  await expect(page.getByLabel("حد الجهد", { exact: true })).toHaveValue("9");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/coach-policy-ar-mobile.png", animations: "disabled" });
});

test("a stale nutrition editor cannot overwrite another tab's pending edit", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    id = crypto.randomUUID();
  await trainingFeatures(context, { offline: true });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  backend.tables.food_logs = [
    {
      id,
      member_id: userId,
      log_date: day,
      meal: "breakfast",
      name: "Oats",
      calories: 200,
      protein_g: 10,
      carbs_g: 30,
      fat_g: 5,
      revision: 1,
    },
  ];
  await page.goto("/nutrition");
  const other = await context.newPage();
  await other.goto("/nutrition");
  await expect(other.getByRole("button", { name: "Edit Oats", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Edit Oats", exact: true }).click();
  await other.getByRole("button", { name: "Edit Oats", exact: true }).click();
  await page.getByLabel("Calories", { exact: true }).fill("400");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await other.getByLabel("Calories", { exact: true }).fill("500");
  await other.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(other.getByRole("dialog").getByRole("alert")).toContainText("another tab");
  await expect(other.getByLabel("Calories", { exact: true })).toHaveValue("500");
  expect(backend.tables.food_logs![0]!.calories).toBe(200);
});

test("member sections restore URLs and profile navigation protects unsaved preferences and passwords", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  await page.goto("/progress");
  await expect(page.getByRole("button", { name: "Overview", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Weight kg", { exact: true })).toHaveCount(0);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/progress-overview-mobile.png" });
  await page.getByRole("button", { name: "Body", exact: true }).click();
  await page.getByRole("button", { name: "Add measurements", exact: true }).click();
  await expect(page.getByLabel("Weight kg", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Body", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Add measurements", exact: true }).click();
  await page.getByLabel("Weight kg", { exact: true }).fill("79");
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Photos", exact: true }).click();
  await page.getByRole("button", { name: "Slider overlay", exact: true }).click();
  await expect(page.getByLabel("Drag to reveal · Before / After")).toBeVisible();
  await page.goBack();
  await page.getByRole("button", { name: "Add measurements", exact: true }).click();
  await expect(page.getByLabel("Weight kg", { exact: true })).toHaveValue("79");
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/rewards?section=shop");
  await expect(page.getByRole("button", { name: "Community", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Level 91 Locked", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Community", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Leaderboard & activity by Pod" })).toBeVisible();
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("section")).toBe("shop");
  await page.goto("/profile?section=preferences");
  await expect(page.getByLabel("Display name", { exact: true })).toBeVisible();
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/profile-preferences-mobile.png" });
  await page.getByLabel("Display name", { exact: true }).fill("Unsaved name");
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Unsaved changes");
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Unsaved name");
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Discard and continue", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("section")).toBe("privacy");
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.getByLabel("Display name", { exact: true }).fill("Saved name");
  let rejectProfileSave = true;
  await context.route("**/rest/v1/profiles?**", async (route) => {
    if (route.request().method() === "PATCH" && rejectProfileSave) {
      rejectProfileSave = false;
      await route.fulfill({ json: [] });
    } else await route.fallback();
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not save preferences");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Saved name");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.locator("[data-profile-password] summary").click();
  await page.getByLabel("New password", { exact: true }).fill("TemporaryPassword1");
  await page.getByRole("button", { name: "Show password", exact: true }).first().click();
  await expect(page.getByLabel("New password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "App", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
});

test("history filters use Cairo dates and URL state survives refresh, Back and linked workouts", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const todayId = crypto.randomUUID(),
    oldId = crypto.randomUUID(),
    importId = crypto.randomUUID();
  backend.tables.workout_sessions = [
    {
      id: todayId,
      member_id: userId,
      title: "Leg%_Day",
      started_at: "2026-10-29T22:15:00Z",
      finished_at: "2026-10-29T23:15:00Z",
      origin: "native",
      activity_date: null,
    },
    {
      id: oldId,
      member_id: userId,
      title: "Previous Cairo day",
      started_at: "2026-10-29T21:15:00Z",
      finished_at: "2026-10-29T21:45:00Z",
      origin: "native",
      activity_date: null,
    },
    {
      id: importId,
      member_id: userId,
      title: "Imported record",
      started_at: "2026-10-27T00:00:00Z",
      finished_at: "2026-10-27T00:00:00Z",
      activity_date: "2026-10-30",
      time_precision: "date",
      origin: "import",
    },
  ];
  await page.goto("/train?section=history");
  await page.getByRole("button", { name: "Filter by Workout or Date", exact: true }).click();
  await page.getByLabel("From date", { exact: true }).fill("2026-10-30");
  await page.getByLabel("To date", { exact: true }).fill("2026-10-30");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View workout details: Leg%_Day", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View workout details: Imported record", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View workout details: Previous Cairo day", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Search workout titles").fill("Leg%_Day");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View workout details: Imported record", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View workout details: Leg%_Day", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("session")).toBe(todayId);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "View workout details: Leg%_Day", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "My program", exact: true }).click();
  await page.goBack();
  await expect(page.getByLabel("Search workout titles")).toHaveValue("Leg%_Day");
  await page.goto(`/train?section=history&page=9&session=${oldId}`);
  await expect(
    page.getByText("Linked workout outside this page's results", { exact: true }),
  ).toBeVisible();
  await page.goto(`/train?section=history&session=${crypto.randomUUID()}`);
  await expect(page.getByRole("alert")).toContainText("unavailable for your account");
});

for (const locale of ["en", "ar"] as const) {
  test(`Phase 3 Today and Nutrition preserve scheduled targets and offline fuel in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    await trainingFeatures(context, { scheduling: true, guidance: true, offline: true });
    const assignment = crypto.randomUUID(),
      version = crypto.randomUUID();
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    backend.tables.program_assignments = [
      { id: assignment, member_id: userId, program_version_id: version, active: true },
    ];
    backend.tables.program_versions = [
      {
        id: version,
        name: "Foundation strength",
        version: 1,
        weeks: 1,
        items: [
          {
            id: crypto.randomUUID(),
            exercise_id: exerciseId,
            week: 1,
            day: 1,
            position: 0,
            target_sets: 3,
            target_reps: "8–12",
            name_en: "Frozen press",
            name_ar: "ضغط معتمد",
            muscle: "chest",
            equipment: "barbell",
            logging_mode: "weighted_reps",
            load_convention: "external_total",
          },
        ],
      },
    ];
    backend.tables.program_schedules = [
      { assignment_id: assignment, member_id: userId, mode: "rotation", start_date: day },
    ];
    backend.tables.session_occurrences = [
      {
        id: crypto.randomUUID(),
        assignment_id: assignment,
        member_id: userId,
        program_version_id: version,
        ordinal: 1,
        week: 1,
        day: 1,
        status: "scheduled",
        due_date: day,
      },
    ];
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await page.goto("/today");
    const hero = page.locator("[data-stitch-today-session]");
    await expect(
      hero.getByRole("heading", { name: "Foundation strength", exact: true }),
    ).toBeVisible();
    await expect(hero).toContainText(l("Frozen press", "ضغط معتمد"));
    await expect(hero).toContainText("3 × 8–12");
    await expect(
      page.getByRole("link", { name: l("Start workout", "ابدأ التمرين"), exact: true }),
    ).toHaveCount(1);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expectAlignedControls(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `artifacts/phase3-today-${locale}.png`, fullPage: true });
    await page.goto("/nutrition");
    await expect(page.locator("[data-stitch-nutrition-summary]")).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.getByRole("button", { name: l("Add food", "إضافة طعام"), exact: true }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel(l("Calories", "السعرات"), { exact: true }).fill("450");
    await sheet.getByLabel(l("Protein", "البروتين"), { exact: true }).fill("35");
    await sheet.getByLabel(l("Carbs", "الكربوهيدرات"), { exact: true }).fill("40");
    await sheet.getByLabel(l("Fat", "الدهون"), { exact: true }).fill("12");
    await sheet
      .getByRole("navigation", { name: l("Choose meal", "اختيار الوجبة"), exact: true })
      .getByRole("button", { name: l("Lunch", "الغداء"), exact: true })
      .click();
    await expectAlignedControls(page);
    await sheet.screenshot({ path: `artifacts/phase3-food-sheet-${locale}.png` });
    await sheet.getByRole("button", { name: l("Add food", "إضافة طعام"), exact: true }).click();
    await expect(sheet).toBeHidden();
    await page.getByRole("button", { name: "+750 ml", exact: true }).click();
    await expect(page.getByText("750 / 2500 ml", { exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/phase3-nutrition-${locale}.png`, fullPage: true });
    await page.reload();
    await expect(page.getByText("750 / 2500 ml", { exact: true })).toBeVisible();
    await expect(page.locator("[data-stitch-meals]")).toContainText("450 kcal");
    await page.goto("/today");
    await expect(page.getByText("450 / 2200 kcal", { exact: true })).toBeVisible();
    expect(backend.tables.food_logs).toHaveLength(0);
    expect(backend.tables.water_logs).toHaveLength(0);
  });
}

test("Today uses the same pending offline food and water totals as Nutrition", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { offline: true });
  await page.goto("/today");
  await expect(page.getByText("0 / 2200 kcal", { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto("/nutrition");
  await expect(page.getByText("0 / 2500 ml", { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByLabel("Calories", { exact: true }).fill("500");
  await page.getByLabel("Protein", { exact: true }).fill("40");
  await page.getByRole("dialog").getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByRole("button", { name: "+250 ml", exact: true }).click();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page.getByText("500 / 2200 kcal", { exact: true })).toBeVisible();
  await expect(page.getByText("40 / 150 g", { exact: true })).toBeVisible();
  await expect(page.getByText("250 / 2500 ml", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/today-actions-mobile.png" });
  expect(backend.tables.food_logs).toHaveLength(0);
  expect(backend.tables.water_logs).toHaveLength(0);
});

test("nutrition sheet preserves invalid drafts across methods and reads older dates online", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { offline: true });
  backend.tables.food_logs = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      log_date: "2026-09-01",
      meal: "lunch",
      name: "Older meal",
      calories: 400,
      protein_g: 30,
      carbs_g: 20,
      fat_g: 10,
    },
  ];
  await page.goto("/nutrition?day=2026-09-01&entry=quick&meal=lunch");
  await page.getByLabel("Calories", { exact: true }).fill("oops");
  await page.getByRole("dialog").getByRole("button", { name: "Add food", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await page.getByRole("button", { name: "Quick macros", exact: true }).click();
  await expect(page.getByLabel("Calories", { exact: true })).toHaveValue("oops");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("listitem").getByText("Older meal", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Log date", { exact: true })).toHaveValue("2026-09-01");
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await expect(page.getByLabel("Calories", { exact: true })).toHaveValue("oops");
  expect(backend.tables.food_logs).toHaveLength(1);
  await page.getByRole("dialog").evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect
    .poll(() =>
      page.getByRole("dialog").evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.left >= -1 && box.right <= innerWidth + 1;
      }),
    )
    .toBe(true);
  await page.screenshot({ path: "artifacts/nutrition-entry-mobile.png" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await page.getByRole("button", { name: "إضافة طعام", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("combobox", { name: "الوجبة", exact: true }),
  ).toHaveValue("lunch");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("تحقق من البيانات");
  await expect
    .poll(() =>
      page.getByRole("dialog").evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.left >= -1 && box.right <= innerWidth + 1;
      }),
    )
    .toBe(true);
  expect(await page.getByRole("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "artifacts/nutrition-entry-ar-mobile.png" });
  await context.setOffline(true);
  await page.getByRole("dialog").locator('input[inputmode="numeric"]').fill("500");
  await page.getByRole("dialog").locator('button[type="submit"]').click();
  await expect(page.getByRole("listitem").getByText("Quick add", { exact: true })).toBeVisible();
  expect(backend.tables.food_logs).toHaveLength(1);
});

test("quick macros, reusable favorite, water feedback, roadmap and PNG export", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByLabel("Calories", { exact: true }).fill("500");
  await page.getByLabel("Protein", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await expect(page.getByRole("listitem").getByText("Quick add", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await page.getByLabel("Favorite name").fill("Post-workout meal");
  await page.getByRole("button", { name: "Save selected meal", exact: true }).click();
  await page.getByRole("button", { name: "Add Post-workout meal", exact: true }).click();
  await expect.poll(() => backend.tables.food_logs.length).toBe(2);
  await page.getByRole("button", { name: "+250 ml", exact: true }).click();
  await expect(page.getByText("250 / 2500 ml", { exact: true })).toBeVisible();
  await page.goto("/rewards");
  await page.getByRole("button", { name: "Level 91 Locked", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Level 91 · Prime Legend", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Community", exact: true }).click();
  await page.getByRole("combobox", { name: "Leaderboard & activity by Pod" }).selectOption("pod");
  await expect(page.getByText("Coach Tarek", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Journey", exact: true }).click();
  await page.getByRole("button", { name: "Share achievement", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download PNG", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/achievement-card.png" });
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("prime-vanguard-achievement.png");
});

test("million XP guide preserves Prime Legend at level 91 and max level at 100", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.member_xp_totals![0]!.xp = 842400;
  await page.goto("/rewards");
  await expect(
    page.getByRole("heading", { name: "Level 91 · Prime Legend", exact: true }),
  ).toBeVisible();
  const guide = page.getByRole("region", { name: "Earn your next level", exact: true });
  await page.getByRole("button", { name: "Jump to my level", exact: true }).click();
  await expect(page.locator('button[aria-current="step"]')).toBeFocused();
  expect(
    await page
      .getByLabel("100-level journey map", { exact: true })
      .evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  await page.getByText("XP earning rules", { exact: true }).click();
  await expect(guide.getByText("+3,500 XP", { exact: true })).toBeVisible();
  await expect(guide.getByText("+650 XP", { exact: true })).toBeVisible();
  await expect(guide.getByText("+600 XP", { exact: true })).toBeVisible();
  await expect(guide).toContainText("19,150 XP a week");
  await expect(guide).toContainText("1,000,000 XP");
  await page.screenshot({ path: "test-results/xp-guide.png", fullPage: true });
  backend.tables.member_xp_totals![0]!.xp = 1000000;
  await page.reload();
  await page
    .getByRole("dialog", { name: "Level up!", exact: true })
    .getByRole("button", { name: "Keep going", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Level 100 · Prime Legend", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Level 100", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
});

test("coach reassignment uses one RPC, preserves failures and can reactivate a previous coach", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const memberId = "00000000-0000-4000-8000-000000000091";
  const coachA = "00000000-0000-4000-8000-000000000092";
  const coachB = "00000000-0000-4000-8000-000000000093";
  backend.tables.profiles!.push(
    ...[
      [memberId, "Review Member"],
      [coachA, "Coach A"],
      [coachB, "Coach B"],
    ].map(([id, display_name]) => ({
      ...backend.tables.profiles![0],
      id,
      display_name,
      email: `${id}@test.invalid`,
    })),
  );
  backend.tables.user_roles = [
    { user_id: userId, role: "admin" },
    { user_id: coachA, role: "coach" },
    { user_id: coachB, role: "coach" },
  ];
  backend.tables.coach_assignments = [
    { id: "assignment-a", member_id: memberId, coach_id: coachA, active: true },
  ];
  let release: (() => void) | undefined;
  let failNext = true;
  const calls: Row[] = [];
  await context.route("**/rest/v1/rpc/set_member_coach", async (route) => {
    const args = route.request().postDataJSON() as Row;
    calls.push(args);
    if (failNext) {
      failNext = false;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({ status: 503, json: { message: "Assignment unavailable" } });
      return;
    }
    for (const row of backend.tables.coach_assignments!)
      if (row.member_id === args._member) row.active = false;
    if (args._coach) {
      const old = backend.tables.coach_assignments!.find(
        (row) => row.member_id === args._member && row.coach_id === args._coach,
      );
      if (old) old.active = true;
      else
        backend.tables.coach_assignments!.push({
          id: "assignment-b",
          member_id: args._member,
          coach_id: args._coach,
          active: true,
        });
    }
    await route.fulfill({ json: null });
  });
  await page.goto("/admin/members");
  const row = page.getByRole("listitem").filter({ hasText: "Review Member" });
  await row.getByRole("button", { name: /Manage member/ }).click();
  const select = page
    .getByRole("dialog", { name: "Manage member", exact: true })
    .getByRole("combobox");
  await expect(select).toHaveValue(coachA);
  await select.selectOption(coachB);
  const review = page.getByRole("dialog", { name: "Review member changes" });
  await expect(review).toContainText("Review Member");
  await expect(review).toContainText("Coach A");
  await expect(review).toContainText("Coach B");
  expect(calls).toHaveLength(0);
  await review.getByRole("button", { name: "Keep editing" }).click();
  await expect(select).toHaveValue(coachA);
  await select.selectOption(coachB);
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("button", { name: "…", exact: true })).toBeDisabled();
  await expect.poll(() => !!release).toBe(true);
  release!();
  await expect(review.getByRole("alert")).toContainText("Assignment unavailable");
  await expect(review).toContainText("Coach B");
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  await expect(select).toHaveValue(coachB);
  await select.selectOption(coachA);
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  await expect(select).toHaveValue(coachA);
  await select.selectOption("");
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  await expect(select).toHaveValue("");
  expect(calls).toHaveLength(4);
  expect(backend.tables.coach_assignments!.filter((row) => row.active)).toHaveLength(0);
});

test("photo deletion retains a retry entry through failure and reload", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.progress_photos = [
    {
      id: "00000000-0000-4000-8000-000000000094",
      member_id: userId,
      path: `${userId}/photo.gif`,
      pose: "front",
      taken_on: "2026-10-01",
    },
  ];
  let fail = true;
  const order: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "DELETE" && request.url().includes("/rest/v1/progress_photos"))
      order.push("metadata");
  });
  await context.route("**/storage/v1/object/progress-photos", async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    order.push("file");
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, json: { message: "Storage unavailable" } });
    } else await route.fulfill({ json: [] });
  });
  await page.goto("/progress?section=photos");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Deletion is incomplete" })).toBeVisible();
  expect(backend.tables.progress_photos).toHaveLength(1);
  expect(backend.tables.photo_deletion_queue).toHaveLength(1);
  expect(order).toEqual(["file"]);
  await page.reload();
  await page.getByRole("button", { name: "Retry removal", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry removal", exact: true })).toHaveCount(0);
  expect(backend.tables.progress_photos).toHaveLength(0);
  expect(backend.tables.photo_deletion_queue).toHaveLength(0);
  expect(order).toEqual(["file", "file", "metadata"]);
});

for (const locale of ["en", "ar"] as const) {
  test(`Phase 3 photo controls crop locally and retry confirmed uploads in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    const sent: Buffer[] = [];
    const existingPhotoCount = backend.tables.progress_photos!.length;
    let fail = true;
    await context.route("**/storage/v1/object/progress-photos/**", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      sent.push(route.request().postDataBuffer()!);
      await route.fulfill(
        fail
          ? { status: 503, json: { message: "Upload unavailable" } }
          : { json: { Id: "file-id", Key: "progress-photos/avatar.jpg" } },
      );
    });
    await page.goto("/profile");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByLabel(l("Take profile photo", "التقاط صورة الملف الشخصي"), { exact: true }),
    ).toHaveAttribute("capture", "user");
    const source = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 400;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#ff0000";
      context.fillRect(0, 0, 400, 400);
      context.fillStyle = "#0000ff";
      context.fillRect(400, 0, 400, 400);
      return canvas.toDataURL("image/png").split(",")[1]!;
    });
    const photo = {
      name: "synthetic-portrait.png",
      mimeType: "image/png",
      buffer: Buffer.from(source, "base64"),
    };
    await page.locator("[data-profile-activity] summary").click();
    const input = page.getByLabel(l("Choose profile photo", "اختر صورة الملف الشخصي"), {
      exact: true,
    });
    await input.setInputFiles(photo);
    const dialog = page.getByRole("dialog", {
      name: l("Crop profile photo", "قص صورة الملف الشخصي"),
      exact: true,
    });
    await expect(dialog.locator("[data-avatar-crop-preview]")).toBeVisible();
    expect(sent).toHaveLength(0);
    const preview = dialog.locator("[data-avatar-crop-preview]");
    const box = (await preview.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2);
    await page.mouse.up();
    await expect
      .poll(async () =>
        Number(
          await dialog
            .getByLabel(l("Horizontal framing", "الإطار الأفقي"), { exact: true })
            .inputValue(),
        ),
      )
      .toBeLessThan(50);
    await dialog
      .getByRole("button", { name: l("Reset crop", "إعادة ضبط القص"), exact: true })
      .click();
    await expect(
      dialog.getByLabel(l("Horizontal framing", "الإطار الأفقي"), { exact: true }),
    ).toHaveValue("50");
    await preview.scrollIntoViewIfNeeded();
    const touchBox = (await preview.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const centerX = touchBox.x + touchBox.width / 2,
      centerY = touchBox.y + touchBox.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: centerX - 30, y: centerY, id: 1 },
        { x: centerX + 30, y: centerY, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: centerX - 60, y: centerY, id: 1 },
        { x: centerX + 60, y: centerY, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect
      .poll(async () =>
        Number(await dialog.getByLabel(l("Zoom", "التكبير"), { exact: true }).inputValue()),
      )
      .toBeGreaterThan(1.5);
    await cdp.detach();
    await dialog
      .getByRole("button", { name: l("Reset crop", "إعادة ضبط القص"), exact: true })
      .click();
    await dialog.getByRole("button", { name: l("Cancel", "إلغاء"), exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(sent).toHaveLength(0);
    await input.setInputFiles(photo);
    await expect(dialog.locator("[data-avatar-crop-preview]")).toBeVisible();
    await dialog.getByLabel(l("Zoom", "التكبير"), { exact: true }).focus();
    await page.keyboard.press("Home");
    for (let step = 0; step < 20; step++) await page.keyboard.press("ArrowRight");
    await expect(dialog.getByLabel(l("Zoom", "التكبير"), { exact: true })).toHaveValue("2");
    await dialog.getByLabel(l("Horizontal framing", "الإطار الأفقي"), { exact: true }).focus();
    await page.keyboard.press("End");
    await dialog.screenshot({ path: `artifacts/phase3-avatar-crop-${locale}.png` });
    expect(sent).toHaveLength(0);
    await dialog
      .getByRole("button", { name: l("Use photo & upload", "استخدام الصورة ورفعها"), exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByLabel(l("Zoom", "التكبير"), { exact: true })).toHaveValue("2");
    expect(sent).toHaveLength(1);
    fail = false;
    await dialog
      .getByRole("button", { name: l("Use photo & upload", "استخدام الصورة ورفعها"), exact: true })
      .click();
    await expect(dialog).toBeHidden();
    expect(sent).toHaveLength(2);
    const body = sent[1]!;
    const start = body.indexOf(Buffer.from([255, 216])),
      end = body.lastIndexOf(Buffer.from([255, 217])) + 2;
    expect(start).toBeGreaterThanOrEqual(0);
    const result = await page.evaluate(
      async (bytes) => {
        const image = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
        );
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const pixel = [...context.getImageData(256, 256, 1, 1).data];
        const result = { width: image.width, height: image.height, pixel };
        image.close();
        return result;
      },
      [...body.subarray(start, end)],
    );
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.pixel[0]).toBeLessThan(30);
    expect(result.pixel[2]).toBeGreaterThan(200);
    expect(String(backend.tables.profiles![0]!.avatar_url)).toContain(`${userId}/avatar-`);
    await page.goto("/progress?section=photos");
    const camera = page.getByLabel(l("Take progress photo", "التقاط صورة التقدم"), { exact: true });
    await expect(camera).toHaveAttribute("capture", "environment");
    await camera.setInputFiles(photo);
    await expect.poll(() => sent.length).toBe(3);
    await expect.poll(() => backend.tables.progress_photos!.length).toBe(existingPhotoCount + 1);
  });
}

test("new progress uploads normalize to JPEG and retain a cleanup reference on failure", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.progress_photos = [];
  const sent: Buffer[] = [];
  let fail = false;
  await context.route("**/storage/v1/object/progress-photos/**", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    expect(backend.tables.progress_photos.length).toBeGreaterThan(0);
    sent.push(route.request().postDataBuffer()!);
    await route.fulfill(
      fail
        ? { status: 503, json: { message: "Upload unavailable" } }
        : { json: { Id: "file-id", Key: "progress-photos/photo.jpg" } },
    );
  });
  await page.goto("/progress?section=photos");
  await page.getByLabel("Choose progress photo").setInputFiles({
    name: "source.png",
    mimeType: "image/png",
    buffer: readFileSync("src/assets/logo.png"),
  });
  await expect.poll(() => sent.length).toBe(1);
  await expect(page.getByRole("button", { name: "Add photo", exact: true })).toBeEnabled();
  expect(sent[0]!.includes(Buffer.from([255, 216, 255]))).toBe(true);
  expect(String(backend.tables.progress_photos[0]!.path)).toMatch(/\.jpg$/);
  fail = true;
  await page.getByLabel("Choose progress photo").setInputFiles({
    name: "source.png",
    mimeType: "image/png",
    buffer: readFileSync("src/assets/logo.png"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Upload was not confirmed" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry removal", exact: true })).toBeVisible();
  expect(backend.tables.progress_photos).toHaveLength(2);
  expect(backend.tables.photo_deletion_queue).toHaveLength(1);
});

test("profile sign-out clears other tabs and a new identity cannot render cached admin data", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const b = "00000000-0000-4000-8000-000000000096";
  backend.tables.profiles!.push(
    { ...backend.tables.profiles![0], id: b, display_name: "Member B", email: "b@test.invalid" },
    {
      ...backend.tables.profiles![0],
      id: "00000000-0000-4000-8000-000000000097",
      display_name: "Sensitive Victim",
      email: "private@test.invalid",
    },
  );
  backend.tables.user_roles = [
    { user_id: userId, role: "admin" },
    { user_id: b, role: "member" },
  ];
  await page.goto("/admin/members");
  // Select the visible mobile heading, not text duplicated in the desktop table and action labels.
  await expect(page.getByRole("heading", { name: "Sensitive Victim", exact: true })).toBeVisible();
  const original = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
    )!;
    return JSON.parse(localStorage.getItem(key)!);
  });
  const other = await context.newPage();
  await other.goto("/profile");
  await other.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(other).toHaveURL(/\/auth/);
  await page.bringToFront();
  await expect(page).toHaveURL(/\/auth/);
  await expect.poll(() => new URL(page.url()).searchParams.get("redirect")).toBe("/admin/members");
  await expect(page.getByText("Sensitive Victim", { exact: true })).toHaveCount(0);
  const userB = { ...user, id: b, email: "b@test.invalid" };
  const tokenBody = Buffer.from(
    JSON.stringify({
      sub: b,
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 86400,
    }),
  ).toString("base64url");
  await context.route("**/auth/v1/**", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").pop();
    if (action === "token")
      await route.fulfill({
        json: { ...original, user: userB, access_token: `eyJhbGciOiJIUzI1NiJ9.${tokenBody}.test` },
      });
    else await route.fulfill({ json: userB });
  });
  let release!: () => void;
  let requested = false;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route("**/rest/v1/user_roles**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("user_id") === `eq.${b}`) {
      requested = true;
      await hold;
    }
    await route.fallback();
  });
  await page.evaluate(() => {
    const state = { leaked: false };
    (window as unknown as { reviewPrivacy: { leaked: boolean } }).reviewPrivacy = state;
    new MutationObserver(() => {
      if (document.body.textContent?.includes("Sensitive Victim")) state.leaked = true;
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.getByLabel("Email", { exact: true }).fill("b@test.invalid");
  await page.getByLabel("Password", { exact: true }).fill("Member-password-123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  await expect(page.getByText("Checking permissions…", { exact: true })).toBeVisible();
  await expect(page.getByText("Sensitive Victim", { exact: true })).toHaveCount(0);
  release();
  await expect(
    page.getByText("You don't have access to this area.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { reviewPrivacy: { leaked: boolean } }).reviewPrivacy.leaked,
    ),
  ).toBe(false);
  await other.close();
});

test("admin analytics exports the complete roster safely and blocks export after a failed refresh", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  const rows = Array.from({ length: 1105 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    display_name: i === 0 ? "=1+1" : `Member ${i + 1}`,
    email: `member-${i}@test.invalid`,
    access_active: true,
    created_at: "2026-01-01T00:00:00Z",
    xp: i === 1104 ? 30003 : i,
    pv: 20,
    w7: 0,
    w30: 0,
  }));
  const snapshot = {
    asOf: "2026-10-26T10:00:00Z",
    period: { from7: "2026-10-20", from30: "2026-09-27", to: "2026-10-26" },
    kpi: {
      members: 1105,
      activeMembers: 1105,
      engaged7: 0,
      workouts7: 0,
      workouts30: 0,
      pvIssued: 22100,
      pendingClaims: 0,
      pendingRedemptions: 0,
    },
    rows,
  };
  let fail = false;
  await context.route("**/rest/v1/rpc/get_admin_analytics", (route) =>
    route.fulfill(
      fail ? { status: 503, json: { message: "Aggregation unavailable" } } : { json: snapshot },
    ),
  );
  await page.goto("/admin/analytics");
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await expect(
    page
      .getByRole("list", { name: "Member summaries", exact: true })
      .getByText("Member 1105", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next members", exact: true }).click();
  const file = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const csv = readFileSync((await (await file).path())!, "utf8");
  expect(csv).toContain('"text: =1+1"');
  expect(csv).toContain('"Member 1105"');
  expect(csv.trimEnd().split("\r\n")).toHaveLength(1106);
  fail = true;
  await page.getByRole("button", { name: "Refresh analytics", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Complete analytics could not be loaded");
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeDisabled();
  await expect(page.locator("tbody tr")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry analytics", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeEnabled();
  await expect(page.locator("tbody tr")).toHaveCount(50);
});

test("analytics filters retain URL state, defer audit and export all members with fresh authority", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  const other = crypto.randomUUID();
  const rows = [
    {
      id: userId,
      display_name: "Active member",
      email: "active@test.invalid",
      access_active: true,
      created_at: "2026-10-01T00:00:00Z",
      xp: 500,
      pv: 20,
      w7: 2,
      w30: 5,
    },
    {
      id: other,
      display_name: "Paused member",
      email: "paused@test.invalid",
      access_active: false,
      created_at: "2026-10-01T00:00:00Z",
      xp: 10,
      pv: 2,
      w7: 0,
      w30: 0,
    },
  ];
  const snapshot = {
    asOf: "2026-10-30T10:00:00Z",
    period: { from7: "2026-10-24", from30: "2026-10-01", to: "2026-10-30" },
    kpi: {
      members: 2,
      activeMembers: 1,
      engaged7: 1,
      workouts7: 2,
      workouts30: 5,
      pvIssued: 22,
      pendingClaims: 0,
      pendingRedemptions: 0,
    },
    rows,
  };
  await context.route("**/rest/v1/rpc/get_admin_analytics", (route) =>
    route.fulfill({ json: snapshot }),
  );
  backend.tables.audit_log = [
    {
      id: crypto.randomUUID(),
      actor_id: userId,
      action: "redemption_fulfilled",
      target_type: "redemption",
      created_at: "2026-10-30T10:00:00Z",
    },
  ];
  let auditReads = 0;
  await context.route("**/rest/v1/audit_log**", (route) => {
    auditReads++;
    return route.fallback();
  });
  await page.goto("/admin/analytics");
  await expect(
    page.getByRole("list", { name: "Member summaries", exact: true }).getByRole("listitem"),
  ).toHaveCount(2);
  expect(auditReads).toBe(0);
  await page.getByText("KPI definitions and periods", { exact: true }).click();
  await expect(page.getByText(/PV issued sums positive ledger entries/)).toBeVisible();
  await page.getByRole("textbox", { name: "Search analytics members", exact: true }).fill("Paused");
  await page.getByRole("combobox", { name: "Access filter", exact: true }).selectOption("paused");
  await page.getByRole("combobox", { name: "Member sort", exact: true }).selectOption("workouts");
  // Member-list filters must not rewrite the organization-wide snapshot totals.
  await expect(
    page.getByLabel("Operations metrics", { exact: true }).getByRole("definition").first(),
  ).toHaveText("2");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Search analytics members", exact: true }),
  ).toHaveValue("Paused");
  await expect(
    page.getByRole("list", { name: "Member summaries", exact: true }).getByRole("listitem"),
  ).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const csv = readFileSync((await (await download).path())!, "utf8");
  expect(csv).toContain("Active member");
  expect(csv).toContain("Paused member");
  await expect(page.getByRole("status").filter({ hasText: "2 members exported" })).toBeVisible();
  await page.getByRole("button", { name: "Show / hide audit trail", exact: true }).click();
  await expect(page.getByText("redemption_fulfilled", { exact: true })).toBeVisible();
  expect(auditReads).toBe(1);
  await page
    .getByRole("textbox", { name: "Search audit events", exact: true })
    .fill("no such event");
  await expect(page.getByRole("status").filter({ hasText: "No audit events match" })).toBeVisible();
  backend.tables.profiles![0]!.access_active = false;
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Active administrator access");
  expect(downloads).toBe(0);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 794 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({
      path: "artifacts/admin-analytics-ar.png",
      fullPage: true,
      animations: "disabled",
    });
  const exportBounds = await page
    .getByRole("button", { name: "تصدير CSV", exact: true })
    .boundingBox();
  expect(exportBounds).not.toBeNull();
  expect(exportBounds!.x).toBeGreaterThanOrEqual(0);
  expect(exportBounds!.x + exportBounds!.width).toBeLessThanOrEqual(320);
});

test("member management searches beyond the REST cap while paging the displayed roster", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  backend.tables.profiles!.push(
    ...Array.from({ length: 1104 }, (_, i) => ({
      ...backend.tables.profiles![0],
      id: `00000000-0000-4000-8000-${String(i + 2).padStart(12, "0")}`,
      display_name: `Member ${i + 2}`,
      email: `member-${i}@test.invalid`,
    })),
  );
  let reads = 0;
  await context.route("**/rest/v1/profiles**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("id")) return route.fallback();
    const offset = Number(url.searchParams.get("offset") ?? 0);
    reads++;
    await route.fulfill({ json: backend.tables.profiles!.slice(offset, offset + 100) });
  });
  await page.goto("/admin/members");
  await expect(page.getByRole("listitem")).toHaveCount(50);
  // Summary totals describe the full roster, even while the list is paginated.
  const rosterSummary = page.getByRole("definition").filter({ hasText: /^1105$/ });
  await expect(rosterSummary).toHaveCount(3);
  await page.getByRole("textbox").fill("Member 1105");
  await expect(page.getByRole("heading", { name: "Member 1105", exact: true })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("definition").filter({ hasText: /^1105$/ })).toHaveCount(2);
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.screenshot({ path: "artifacts/phase6-roster-en.png", fullPage: true });
  expect(reads).toBeGreaterThan(10);
});

test("body and target inputs reject invalid values and accept Arabic numerals without clamping", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  await page.goto("/progress?section=body");
  await page.getByRole("button", { name: "Add measurements", exact: true }).click();
  await page.getByLabel("Body fat %", { exact: true }).fill("101");
  await page.getByRole("button", { name: "Save measurement", exact: true }).click();
  await expect(page.locator("#body-input-error")).toContainText("at most 100");
  expect(backend.tables.body_measurements ?? []).toHaveLength(0);
  await page.getByLabel("Weight kg", { exact: true }).fill("٨٠٫٥");
  await page.getByLabel("Body fat %", { exact: true }).fill("٢٠");
  await page.getByRole("button", { name: "Save measurement", exact: true }).click();
  await expect.poll(() => backend.tables.body_measurements?.length).toBe(1);
  expect(backend.tables.body_measurements![0]).toMatchObject({ weight_kg: 80.5, body_fat_pct: 20 });
  await page.goto("/admin/targets");
  await page.getByRole("combobox", { name: /^member$/i }).selectOption(userId);
  await expect(page.getByLabel("kcal", { exact: true })).toHaveValue("2200");
  await page.getByLabel("kcal", { exact: true }).fill("-100");
  await page.getByRole("button", { name: "Review targets", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("at least 0");
  expect(backend.tables.nutrition_targets![0]!.calories).toBe(2200);
  await page.getByLabel("kcal", { exact: true }).fill("٢٤٠٠");
  await page.getByRole("button", { name: "Review targets", exact: true }).click();
  expect(backend.tables.nutrition_targets![0]!.calories).toBe(2200);
  await page
    .getByRole("dialog", { name: "Review daily targets" })
    .getByRole("button", { name: "Confirm changes" })
    .click();
  await expect.poll(() => backend.tables.nutrition_targets![0]!.calories).toBe(2400);
});

test("target drafts survive member switching, stale refresh and acknowledgement loss", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  const other = "00000000-0000-4000-8000-000000000099";
  backend.tables.profiles!.push({
    ...backend.tables.profiles![0],
    id: other,
    display_name: "Other member",
    email: "other@test.invalid",
  });
  backend.tables.nutrition_targets!.push({
    ...backend.tables.nutrition_targets![0],
    member_id: other,
    calories: 1800,
  });
  let patches = 0,
    lose = true;
  await context.route("**/rest/v1/nutrition_targets**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    patches++;
    if (lose) {
      lose = false;
      Object.assign(backend.tables.nutrition_targets![0]!, route.request().postDataJSON(), {
        updated_at: "2026-10-30T10:00:00Z",
      });
      await route.abort("connectionfailed");
      return;
    }
    return route.fallback();
  });
  await page.goto("/admin/targets");
  const picker = page.getByRole("combobox", { name: /^member$/i });
  const editor = page.getByRole("region", { name: "Daily targets editor" });
  await expect(
    page.getByRole("status").filter({ hasText: "Select a member to view their saved targets" }),
  ).toBeVisible();
  await picker.selectOption(userId);
  await expect(editor.getByRole("group", { name: "Energy & macros", exact: true })).toBeVisible();
  await expect(editor.getByRole("group", { name: "Hydration", exact: true })).toBeVisible();
  await expect(editor.getByLabel("kcal", { exact: true })).toHaveValue("2200");
  await editor.getByLabel("kcal", { exact: true }).fill("2400");
  await picker.selectOption(other);
  await expect(editor.getByLabel("kcal", { exact: true })).toHaveValue("1800");
  await picker.selectOption(userId);
  await expect(editor.getByLabel("kcal", { exact: true })).toHaveValue("2400");
  // Staff navigation uses Dashboard; exercise the real route-exit draft guard.
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  const blocker = page.getByRole("alertdialog", { name: "Unsaved target drafts" });
  await expect(blocker).toBeVisible();
  await blocker.getByRole("button", { name: "Keep editing" }).click();
  await editor.getByRole("button", { name: "Review targets" }).click();
  const review = page.getByRole("dialog", { name: "Review daily targets" });
  await expect(review).toContainText("2200");
  await expect(review).toContainText("2400");
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toBeVisible();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  await expect(editor.getByRole("status")).toContainText("Daily targets saved");
  expect(patches).toBe(1);
  await editor.getByLabel("kcal", { exact: true }).fill("2600");
  Object.assign(backend.tables.nutrition_targets![0]!, {
    calories: 2500,
    updated_at: "2026-10-30T11:00:00Z",
  });
  await editor.getByRole("button", { name: "Review targets" }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toContainText("another tab");
  expect(patches).toBe(1);
  await review.getByRole("button", { name: "Keep editing" }).click();
  await expect(editor.getByLabel("kcal", { exact: true })).toHaveValue("2600");
  await editor.getByRole("button", { name: "Reload saved targets" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard and reload" }).click();
  await expect(editor.getByLabel("kcal", { exact: true })).toHaveValue("2500");
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/admin-targets-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(editor.getByLabel("kcal", { exact: true })).toHaveValue("2500");
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/phase6-targets-desktop.png", animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 794 });
  const arabic = page.getByRole("region", { name: "تعديل الأهداف اليومية" });
  await arabic.getByLabel("kcal", { exact: true }).fill("٢٦٠٠");
  await arabic.getByRole("button", { name: "مراجعة الأهداف", exact: true }).click();
  const arabicReview = page.getByRole("dialog", { name: "مراجعة الأهداف اليومية" });
  await expect(arabicReview).toBeInViewport({ ratio: 0.99 });
  await expect(arabicReview).toContainText("2600");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({
      path: "artifacts/admin-targets-ar-mobile.png",
      animations: "disabled",
    });
  expect(patches).toBe(1);
});

test("member role and access review retains denied writes and filters accepted changes", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const member = "00000000-0000-4000-8000-000000000098";
  backend.tables.user_roles = [
    { user_id: userId, role: "admin" },
    { user_id: member, role: "member" },
  ];
  backend.tables.profiles!.push({
    ...backend.tables.profiles![0],
    id: member,
    display_name: "Managed member",
    email: "an-extremely-long-member-address-that-needs-wrapping@test.invalid",
  });
  let block = true,
    writes = 0;
  await context.route("**/rest/v1/profiles**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    writes++;
    if (block) {
      block = false;
      await route.fulfill({ json: [] });
      return;
    }
    return route.fallback();
  });
  await page.goto("/admin/members");
  const row = page.getByRole("listitem").filter({ hasText: "Managed member" });
  await row.getByRole("button", { name: /Manage member/ }).click();
  const editor = page.getByRole("dialog", { name: "Manage member", exact: true });
  await editor.getByRole("button", { name: /^Access:/ }).click();
  const review = page.getByRole("dialog", { name: "Review member changes" });
  expect(writes).toBe(0);
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toContainText("not confirmed");
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  await expect(editor.getByRole("button", { name: /^Access:/ })).toContainText("Paused");
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("combobox", { name: "Access filter" }).selectOption("paused");
  await expect(
    page.getByRole("list", { name: "Member roster", exact: true }).getByRole("listitem"),
  ).toHaveCount(1);
  await row.getByRole("button", { name: /Manage member/ }).click();
  await editor.getByRole("button", { name: "Coach", exact: true }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("combobox", { name: "Role filter" }).selectOption("coach");
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Manage member/ }).click();
  await editor.getByRole("button", { name: "Coach", exact: true }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Member roster", exact: true }).getByRole("listitem"),
  ).toHaveCount(0);
  expect(writes).toBe(2);
  await page.getByRole("combobox", { name: "Role filter" }).selectOption("all");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 794 });
  await expect(row).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/admin-members-ar-mobile.png", fullPage: true });
});

function seedAdminPods(backend: Awaited<ReturnType<typeof fakeBackend>>, count = 3) {
  const pod = "00000000-0000-4000-8000-000000009001",
    leaderA = "00000000-0000-4000-8000-000000009002",
    leaderB = "00000000-0000-4000-8000-000000009003";
  const members = Array.from({ length: count }, (_, i) => ({
    ...backend.tables.profiles![0],
    id: `00000000-0000-4000-8000-${String(10000 + i).padStart(12, "0")}`,
    display_name: `Roster ${i + 1}`,
    email: `roster-${i + 1}@test.invalid`,
  }));
  backend.tables.profiles!.push(
    { ...backend.tables.profiles![0], id: leaderA, display_name: "Leader A" },
    { ...backend.tables.profiles![0], id: leaderB, display_name: "Leader B" },
    ...members,
  );
  backend.tables.user_roles = [
    { user_id: userId, role: "admin" },
    { user_id: leaderA, role: "pod_leader" },
    { user_id: leaderB, role: "pod_leader" },
  ];
  backend.tables.pods = [
    {
      id: pod,
      name: "Test Pod",
      leader_id: leaderA,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-29T00:00:00Z",
      description: null,
    },
  ];
  backend.tables.pod_members = members
    .slice(0, Math.min(count, 1005))
    .map((p) => ({ pod_id: pod, member_id: p.id, created_at: "2026-10-29T00:00:00Z" }));
  return { pod, leaderA, leaderB, members };
}

test("Pod summaries load complete counts and reviewed roster changes survive failures and retries", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    fixture = seedAdminPods(backend, 1105);
  let profileLists = 0,
    additions = 0,
    removals = 0,
    leaderWrites = 0;
  let failLeader = true,
    loseAdd = true,
    blockRemove = true;
  await context.route("**/rest/v1/profiles**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET" || url.searchParams.has("id")) return route.fallback();
    profileLists++;
    const offset = Number(url.searchParams.get("offset") ?? 0);
    await route.fulfill({ json: backend.tables.profiles!.slice(offset, offset + 100) });
  });
  await context.route("**/rest/v1/pods**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    leaderWrites++;
    if (failLeader) {
      failLeader = false;
      await route.fulfill({ status: 503, json: { message: "Leader update unavailable" } });
      return;
    }
    return route.fallback();
  });
  await context.route("**/rest/v1/pod_members**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() === "GET" && !url.searchParams.has("pod_id")) {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      await route.fulfill({ json: backend.tables.pod_members!.slice(offset, offset + 100) });
      return;
    }
    if (request.method() === "POST") {
      additions++;
      if (loseAdd) {
        loseAdd = false;
        backend.tables.pod_members!.push({
          ...request.postDataJSON(),
          created_at: "2026-10-30T11:00:00Z",
        });
        await route.abort("connectionfailed");
        return;
      }
    }
    if (request.method() === "DELETE") {
      removals++;
      if (blockRemove) {
        blockRemove = false;
        await route.fulfill({ json: [] });
        return;
      }
    }
    return route.fallback();
  });
  await page.goto("/admin/pods");
  const summary = page.getByRole("region", { name: "Test Pod", exact: true });
  await expect(summary).toContainText("1005 members");
  await expect(summary).toContainText("Leader A");
  expect(profileLists).toBe(0);
  await expect(summary.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search Pods" }).fill("Test Pod");
  await summary.getByRole("button", { name: "Manage roster" }).click();
  const roster = page.getByRole("dialog", { name: "Manage Pod: Test Pod", exact: true });
  const leader = roster.getByRole("combobox", { name: /^leader$/i });
  await expect(leader).toBeEnabled();
  await expect(
    roster.getByRole("region", { name: "Pod roster" }).getByRole("listitem"),
  ).toHaveCount(25);
  expect(profileLists).toBeGreaterThan(10);
  await expect.poll(() => new URL(page.url()).searchParams.get("pod")).toBe(fixture.pod);
  await leader.selectOption(fixture.leaderB);
  await roster.getByRole("button", { name: "Review leader change" }).click();
  const reviewLeader = page.getByRole("dialog", { name: "Review Pod leader", exact: true });
  await expect(reviewLeader).toContainText("Leader A");
  await expect(reviewLeader).toContainText("Leader B");
  expect(leaderWrites).toBe(0);
  await reviewLeader.getByRole("button", { name: "Keep editing" }).click();
  await roster.getByRole("button", { name: "Close roster" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Test Pod");
  await summary.getByRole("button", { name: "Manage roster" }).click();
  await expect(leader).toHaveValue(fixture.leaderB);
  await roster.getByRole("button", { name: "Review leader change" }).click();
  await reviewLeader.getByRole("button", { name: "Confirm changes" }).click();
  await expect(reviewLeader.getByRole("alert")).toContainText("Leader update unavailable");
  await reviewLeader.getByRole("button", { name: "Confirm changes" }).click();
  await expect(reviewLeader).toHaveCount(0);
  await expect(roster.getByText("Pod leader saved.", { exact: true })).toBeVisible();
  expect(leaderWrites).toBe(2);
  await roster
    .getByRole("textbox", { name: "Search Member to add", exact: true })
    .fill("Roster 1105");
  await roster
    .getByRole("combobox", { name: "Member to add", exact: true })
    .selectOption(String(fixture.members[1104]!.id));
  await roster.getByRole("button", { name: "Review member addition" }).click();
  const addition = page.getByRole("dialog", { name: "Review member addition", exact: true });
  await expect(addition).toContainText("Roster 1105");
  expect(additions).toBe(0);
  await addition.getByRole("button", { name: "Confirm changes" }).click();
  await expect(addition.getByRole("alert")).toBeVisible();
  await addition.getByRole("button", { name: "Confirm changes" }).click();
  await expect(addition).toHaveCount(0);
  await expect(roster).toContainText("1006 roster members");
  expect(additions).toBe(1);
  await roster.getByRole("textbox", { name: "Search roster", exact: true }).fill("Roster 1105");
  const added = roster.getByRole("listitem").filter({ hasText: "Roster 1105" });
  await added.getByRole("button", { name: "Remove", exact: true }).click();
  const removal = page.getByRole("dialog", { name: "Review member removal", exact: true });
  await removal.getByRole("button", { name: "Keep editing" }).click();
  expect(removals).toBe(0);
  await added.getByRole("button", { name: "Remove", exact: true }).click();
  await removal.getByRole("button", { name: "Confirm changes" }).click();
  await expect(removal.getByRole("alert")).toContainText("not confirmed");
  await removal.getByRole("button", { name: "Confirm changes" }).click();
  await expect(removal).toHaveCount(0);
  await expect(added).toHaveCount(0);
  await expect(roster).toContainText("1005 roster members");
  expect(removals).toBe(2);
  await roster.getByRole("button", { name: "Close roster" }).click();
  await expect(summary).toContainText("Leader B");
  await expect(summary).toContainText("1005 members");
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/admin-pods-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 794 });
  await summary.getByRole("button", { name: "إدارة الأعضاء" }).click();
  const arabic = page.getByRole("dialog", { name: "إدارة المجموعة: Test Pod", exact: true });
  await expect(arabic).toBeInViewport({ ratio: 0.99 });
  await expect(
    arabic.getByRole("heading", { name: "إدارة المجموعة: Test Pod", exact: true }),
  ).toBeInViewport({ ratio: 0.99 });
  expect(await arabic.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({
      path: "artifacts/admin-pod-roster-ar-mobile.png",
      animations: "disabled",
    });
});

test("Pod creation retains a stable request and stale leader and membership reviews cannot overwrite new state", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    fixture = seedAdminPods(backend);
  backend.tables.pods = [];
  backend.tables.pod_members = [];
  let creates = 0,
    changes = 0,
    removes = 0;
  await context.route("**/rest/v1/pods**", async (route) => {
    if (route.request().method() === "POST") {
      creates++;
      backend.tables.pods!.push({
        ...route.request().postDataJSON(),
        description: null,
        created_at: "2026-10-30T11:00:00Z",
        updated_at: "2026-10-30T11:00:00Z",
      });
      await route.abort("connectionfailed");
      return;
    }
    if (route.request().method() === "PATCH") changes++;
    return route.fallback();
  });
  await context.route("**/rest/v1/pod_members**", async (route) => {
    if (route.request().method() === "DELETE") removes++;
    return route.fallback();
  });
  await page.goto("/admin/pods");
  await expect(page.getByText("No Pods yet. Create your first Pod to get started.")).toBeVisible();
  await page.getByRole("button", { name: "Create pod", exact: true }).click();
  const creator = page.getByRole("dialog", { name: "Create pod", exact: true });
  await creator.getByLabel("Pod name", { exact: true }).fill("New Pod");
  await creator.getByRole("combobox", { name: /^leader$/i }).selectOption(fixture.leaderA);
  await creator.getByRole("button", { name: "Review new Pod" }).click();
  const creation = page.getByRole("dialog", { name: "Review new Pod", exact: true });
  await creation.getByRole("button", { name: "Keep editing" }).click();
  expect(creates).toBe(0);
  await creator.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Create pod", exact: true }).click();
  await expect(creator.getByLabel("Pod name", { exact: true })).toHaveValue("New Pod");
  await creator.getByRole("button", { name: "Review new Pod" }).click();
  await creation.getByRole("button", { name: "Confirm changes" }).click();
  await expect(creation.getByRole("alert")).toBeVisible();
  await creation.getByRole("button", { name: "Keep editing" }).click();
  await expect(creator.getByLabel("Pod name", { exact: true })).toBeDisabled();
  await creator.getByRole("button", { name: "Review new Pod" }).click();
  await creation.getByRole("button", { name: "Confirm changes" }).click();
  const roster = page.getByRole("dialog", { name: "Manage Pod: New Pod", exact: true });
  await expect(roster).toBeVisible();
  expect(creates).toBe(1);
  expect(backend.tables.pods).toHaveLength(1);
  const leader = roster.getByRole("combobox", { name: /^leader$/i });
  await leader.selectOption(fixture.leaderB);
  backend.tables.pods![0]!.leader_id = null;
  backend.tables.pods![0]!.updated_at = "2026-10-30T12:00:00Z";
  await roster.getByRole("button", { name: "Review leader change" }).click();
  const review = page.getByRole("dialog", { name: "Review Pod leader", exact: true });
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toContainText("another tab");
  expect(changes).toBe(0);
  await review.getByRole("button", { name: "Keep editing" }).click();
  await roster.getByRole("button", { name: "Reload saved leader" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard leader draft" }).click();
  await expect(leader).toHaveValue("");
  backend.tables.pod_members!.push({
    pod_id: backend.tables.pods![0]!.id,
    member_id: fixture.members[0]!.id,
    created_at: "2026-10-30T12:00:00Z",
  });
  await roster.getByRole("button", { name: "Refresh roster" }).click();
  const row = roster.getByRole("listitem").filter({ hasText: "Roster 1" });
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  backend.tables.pod_members![0]!.created_at = "2026-10-30T13:00:00Z";
  const removal = page.getByRole("dialog", { name: "Review member removal", exact: true });
  await removal.getByRole("button", { name: "Confirm changes" }).click();
  await expect(removal.getByRole("alert")).toContainText("membership changed");
  expect(removes).toBe(0);
  await removal.getByRole("button", { name: "Keep editing" }).click();
  await leader.selectOption(fixture.leaderB);
  await roster.getByRole("button", { name: "Close roster" }).click();
  // Stay within staff navigation when checking protection for unsaved Pod drafts.
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(page.getByRole("alertdialog", { name: "Unsaved Pod drafts" })).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Keep editing" }).click();
  await page
    .getByRole("region", { name: "New Pod", exact: true })
    .getByRole("button", { name: "Manage roster" })
    .click();
  await expect(leader).toHaveValue(fixture.leaderB);
  backend.tables.user_roles = backend.tables.user_roles!.filter((r) => r.user_id !== userId);
  await roster.getByRole("button", { name: "Review leader change" }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toContainText("administrator access");
  expect(changes).toBe(0);
});

test("Pod loading failures stay visible and refresh failures preserve leader drafts", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    fixture = seedAdminPods(backend);
  let failPods = true,
    failPeople = true;
  await context.route("**/rest/v1/pods**", async (route) => {
    const url = new URL(route.request().url());
    if (failPods && route.request().method() === "GET" && !url.searchParams.has("id")) {
      await route.fulfill({ status: 503, json: { message: "Pod list unavailable" } });
      return;
    }
    return route.fallback();
  });
  await context.route("**/rest/v1/user_roles**", async (route) => {
    const url = new URL(route.request().url());
    if (failPeople && url.searchParams.get("role") === "eq.pod_leader") {
      await route.fulfill({ status: 503, json: { message: "Leader list unavailable" } });
      return;
    }
    return route.fallback();
  });
  await page.goto("/admin/pods");
  await expect(page.getByRole("alert")).toContainText("complete Pod list could not be loaded");
  await expect(page.getByText("No Pods yet. Create your first Pod to get started.")).toHaveCount(0);
  failPods = false;
  await page.getByRole("button", { name: "Retry Pods" }).click();
  await page
    .getByRole("region", { name: "Test Pod", exact: true })
    .getByRole("button", { name: "Manage roster" })
    .click();
  const roster = page.getByRole("dialog", { name: "Manage Pod: Test Pod", exact: true });
  await expect(roster.getByRole("alert")).toContainText(
    "complete member/leader list could not be loaded",
  );
  await expect(roster.getByRole("combobox", { name: /^leader$/i })).toBeDisabled();
  failPeople = false;
  await roster.getByRole("button", { name: "Retry people" }).click();
  await expect(roster.getByRole("combobox", { name: /^leader$/i })).toBeEnabled();
  await page.reload();
  await expect(roster).toBeVisible();
  const leader = roster.getByRole("combobox", { name: /^leader$/i });
  await expect(leader).toHaveValue(fixture.leaderA);
  await leader.selectOption(fixture.leaderB);
  failPods = true;
  await roster.getByRole("button", { name: "Refresh roster" }).click();
  await expect(roster.getByRole("alert")).toContainText("Changes are paused");
  await expect(leader).toHaveValue(fixture.leaderB);
  await expect(roster.getByRole("button", { name: "Review leader change" })).toBeDisabled();
  failPods = false;
  await roster.getByRole("button", { name: "Refresh roster" }).click();
  await expect(roster.getByRole("button", { name: "Review leader change" })).toBeEnabled();
  await expect(leader).toHaveValue(fixture.leaderB);
});

test("invitations search complete history, retain uncertain creation and confirm revocation", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  backend.tables.invites = Array.from({ length: 1005 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(30000 + i).padStart(12, "0")}`,
    email: `invited-${i}@test.invalid`,
    role: "member",
    invited_by: userId,
    created_at: "2026-10-01T10:00:00Z",
    expires_at: i % 4 === 2 ? "2000-01-01T00:00:00Z" : "2030-11-13T10:00:00Z",
    accepted_at: i % 4 === 1 ? "2026-10-03T10:00:00Z" : null,
    revoked_at: i % 4 === 3 ? "2026-10-03T10:00:00Z" : null,
    coach_id: null,
    pod_id: null,
  }));
  let creates = 0,
    revokes = 0,
    blockRevoke = true;
  await context.route("**/rest/v1/invites**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (
      request.method() === "GET" &&
      !url.searchParams.has("id") &&
      !url.searchParams.has("email")
    ) {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      await route.fulfill({ json: backend.tables.invites!.slice(offset, offset + 100) });
      return;
    }
    if (request.method() === "POST") {
      creates++;
      backend.tables.invites!.push({
        ...request.postDataJSON(),
        accepted_at: null,
        revoked_at: null,
        coach_id: null,
        pod_id: null,
        expires_at: "2030-11-13T10:00:00Z",
        created_at: new Date().toISOString(),
      });
      await route.abort("connectionfailed");
      return;
    }
    if (request.method() === "PATCH") {
      revokes++;
      if (blockRevoke) {
        blockRevoke = false;
        await route.fulfill({ json: [] });
        return;
      }
    }
    return route.fallback();
  });
  await page.goto("/admin/invites");
  await expect(page.getByRole("listitem")).toHaveCount(25);
  // Complete-read totals must survive page and search changes.
  const inviteTotals = page
    .getByLabel("Invitation overview", { exact: true })
    .getByRole("definition");
  await expect(inviteTotals.first()).toHaveText("1005");
  await page
    .getByRole("searchbox", { name: "Search invitations" })
    .fill("invited-1004@test.invalid");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem")).toContainText("Pending");
  await expect(inviteTotals.first()).toHaveText("1005");
  await expect(inviteTotals.nth(2)).toHaveText("1");
  await page.getByRole("combobox", { name: "Invitation status" }).selectOption("accepted");
  await expect(page.getByText("No invitations match these filters.")).toBeVisible();
  await page.getByRole("combobox", { name: "Invitation status" }).selectOption("pending");
  await page.getByRole("button", { name: "Create invitation", exact: true }).click();
  const creator = page.getByRole("dialog", { name: "Create invitation", exact: true });
  await creator.getByLabel("Email", { exact: true }).fill(" NEW_MEMBER@Test.Invalid ");
  await creator.getByRole("button", { name: "Review invitation", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review invitation", exact: true });
  await expect(review).toContainText("new_member@test.invalid");
  expect(creates).toBe(0);
  await review.getByRole("button", { name: "Keep editing" }).click();
  await creator.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Create invitation", exact: true }).click();
  await creator.getByRole("button", { name: "Review invitation", exact: true }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toBeVisible();
  await review.getByRole("button", { name: "Keep editing" }).click();
  await expect(creator.getByLabel("Email", { exact: true })).toBeDisabled();
  await creator.getByRole("button", { name: "Review invitation", exact: true }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(creator).toHaveCount(0);
  expect(creates).toBe(1);
  await expect(page.getByRole("status")).toContainText("email delivery is not confirmed");
  await page.getByRole("searchbox", { name: "Search invitations" }).fill("new_member@test.invalid");
  const row = page.getByRole("listitem");
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Revoke", exact: true }).click();
  const revocation = page.getByRole("dialog", {
    name: "Review invitation revocation",
    exact: true,
  });
  await revocation.getByRole("button", { name: "Keep editing" }).click();
  expect(revokes).toBe(0);
  await row.getByRole("button", { name: "Revoke", exact: true }).click();
  await revocation.getByRole("button", { name: "Confirm changes" }).click();
  await expect(revocation.getByRole("alert")).toContainText("not confirmed");
  await revocation.getByRole("button", { name: "Confirm changes" }).click();
  await expect(revocation).toHaveCount(0);
  expect(revokes).toBe(2);
  await page.getByRole("combobox", { name: "Invitation status" }).selectOption("revoked");
  await expect(row).toContainText("Revoked");
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Search invitations" })).toHaveValue(
    "new_member@test.invalid",
  );
  await expect(row).toContainText("Revoked");
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/admin-invitations-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 794 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/admin-invitations-ar-mobile.png", fullPage: true });
});

test("invitation failures and fresh privilege checks retain drafts and block accepted revocation", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "super_admin" }];
  const invitation = {
    id: crypto.randomUUID(),
    email: "waiting@test.invalid",
    role: "member",
    invited_by: userId,
    accepted_at: null as string | null,
    revoked_at: null,
    created_at: "2026-10-01T10:00:00Z",
    expires_at: "2030-11-13T10:00:00Z",
  };
  backend.tables.invites = [invitation];
  let fail = true,
    writes = 0;
  await context.route("**/rest/v1/invites**", async (route) => {
    const url = new URL(route.request().url());
    if (fail && route.request().method() === "GET" && !url.searchParams.has("id")) {
      await route.fulfill({ status: 400, json: { message: "Invitations unavailable" } });
      return;
    }
    if (route.request().method() !== "GET") writes++;
    return route.fallback();
  });
  await page.goto("/admin/invites");
  await expect(page.getByRole("alert")).toContainText("could not be loaded completely");
  await expect(
    page.getByLabel("Invitation overview", { exact: true }).getByRole("definition").first(),
  ).toHaveText("—");
  await expect(page.getByText("No invitations match these filters.")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry invitations" }).click();
  // Exercise the desktop action against the same stale-record guard as phone cards.
  await page.setViewportSize({ width: 1280, height: 900 });
  const inviteTable = page.getByRole("table", { name: "Invitations", exact: true });
  await expect(inviteTable.getByRole("row")).toHaveCount(2);
  await inviteTable.getByRole("button", { name: "Revoke", exact: true }).click();
  invitation.accepted_at = new Date().toISOString();
  const revocation = page.getByRole("dialog", {
    name: "Review invitation revocation",
    exact: true,
  });
  await revocation.getByRole("button", { name: "Confirm changes" }).click();
  await expect(revocation.getByRole("alert")).toContainText("was accepted");
  expect(writes).toBe(0);
  await revocation.getByRole("button", { name: "Keep editing" }).click();
  await page.getByRole("button", { name: "Create invitation", exact: true }).click();
  const creator = page.getByRole("dialog", { name: "Create invitation", exact: true });
  await creator.getByLabel("Email", { exact: true }).fill("privileged@test.invalid");
  await creator.getByRole("combobox", { name: "Role", exact: true }).selectOption("admin");
  await creator.getByRole("button", { name: "Review invitation" }).click();
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  const review = page.getByRole("dialog", { name: "Review invitation", exact: true });
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toContainText("super administrator");
  expect(writes).toBe(0);
  await review.getByRole("button", { name: "Keep editing" }).click();
  await expect(creator.getByLabel("Email", { exact: true })).toHaveValue("privileged@test.invalid");
});

function seedPvReviews(backend: Awaited<ReturnType<typeof fakeBackend>>, count = 3) {
  const task = crypto.randomUUID();
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  backend.tables.pv_tasks = [
    {
      id: task,
      title_en: "Weekly accountability",
      title_ar: "المتابعة الأسبوعية",
      points: 50,
      active: true,
      created_by: userId,
      created_at: "2026-10-01T10:00:00Z",
      description: null,
    },
  ];
  const people = Array.from({ length: count }, (_, i) => ({
    ...backend.tables.profiles![0],
    id: `00000000-0000-4000-8000-${String(40000 + i).padStart(12, "0")}`,
    display_name: `PV Member ${i + 1}`,
    email: `pv-${i + 1}@test.invalid`,
  }));
  backend.tables.profiles!.push(...people);
  backend.tables.pv_claims = people.map((person) => ({
    id: crypto.randomUUID(),
    task_id: task,
    member_id: person.id,
    note: "<script>window.badEvidence = true</script>\nCompleted the task.",
    status: "pending",
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-10-02T10:00:00Z",
  }));
  backend.tables.pv_claims.push({
    ...backend.tables.pv_claims[0],
    id: crypto.randomUUID(),
    member_id: userId,
  });
  backend.tables.pv_ledger = [];
  return { task, people, claims: backend.tables.pv_claims };
}

test("PV queue searches complete history and approval retries confirm one server award", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    fixture = seedPvReviews(backend, 1005);
  let writes = 0;
  await context.route("**/rest/v1/pv_claims**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "GET" && !url.searchParams.has("id")) {
      const statuses = url.searchParams.get("status")?.slice(4, -1).split(",") ?? [];
      const offset = Number(url.searchParams.get("offset") ?? 0),
        rows = backend.tables
          .pv_claims!.filter((r) => statuses.includes(String(r.status)))
          .slice(offset, offset + 100);
      await route.fulfill({
        json: rows.map((r) => ({ ...r, pv_tasks: backend.tables.pv_tasks![0] })),
      });
      return;
    }
    if (route.request().method() === "PATCH") {
      writes++;
      const id = url.searchParams.get("id")!.slice(3),
        claim = backend.tables.pv_claims!.find((r) => r.id === id)!;
      Object.assign(claim, route.request().postDataJSON(), {
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      });
      backend.tables.pv_ledger!.push({ claim_id: id, member_id: claim.member_id, points: 50 });
      await route.abort("connectionfailed");
      return;
    }
    return route.fallback();
  });
  await page.goto("/admin/pv");
  await expect(page.getByRole("listitem")).toHaveCount(25);
  // Overview totals cover the complete status read, independently of paging/search.
  const overview = page.getByRole("definition");
  await expect(overview.first()).toHaveText("1006");
  await page.getByRole("textbox", { name: "Search claims" }).fill("PV Member 1005");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(overview.first()).toHaveText("1006");
  await expect(overview.nth(1)).toHaveText("1");
  await page.getByRole("button", { name: "Open claim" }).click();
  const editor = page.getByRole("dialog", { name: "Claim review", exact: true });
  await expect(editor.getByLabel("Decision reason", { exact: true })).toBeEnabled();
  await expect(editor.getByRole("region", { name: "Member evidence" })).toContainText("<script>");
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>)["badEvidence"]),
  ).toBeUndefined();
  await editor.getByLabel("Decision reason", { exact: true }).fill("Evidence checked");
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Open claim" }).click();
  await expect(editor.getByLabel("Decision reason", { exact: true })).toHaveValue(
    "Evidence checked",
  );
  await editor.getByRole("button", { name: "Review decision" }).click();
  const review = page.getByRole("dialog", { name: "Review PV decision", exact: true });
  await expect(review).toContainText("PV Member 1005");
  await expect(review).toContainText("50 PV");
  expect(writes).toBe(0);
  await review.getByRole("button", { name: "Keep editing" }).click();
  await editor.getByRole("button", { name: "Review decision" }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toBeVisible();
  await review.getByRole("button", { name: "Keep editing" }).click();
  await expect(editor.getByLabel("Decision reason", { exact: true })).toBeDisabled();
  await editor.getByRole("button", { name: "Review decision" }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  await expect(editor.getByRole("status")).toContainText("Server award receipt: 50 PV");
  expect(writes).toBe(1);
  expect(backend.tables.pv_ledger).toHaveLength(1);
  await expect(editor.getByRole("button", { name: "Review decision" })).toHaveCount(0);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({
      path: "artifacts/admin-pv-receipt-mobile.png",
      animations: "disabled",
    });
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("combobox", { name: "Claim status" }).selectOption("reviewed");
  await expect(page.getByRole("listitem")).toContainText("Approved");
  await page.reload();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  expect(backend.tables.pv_claims!.find((r) => r.id === fixture.claims[1004]!.id)!.status).toBe(
    "approved",
  );
});

test("PV reviews require feedback, reject stale edits and preserve self-review and role restrictions", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    fixture = seedPvReviews(backend);
  let writes = 0;
  await context.route("**/rest/v1/pv_claims**", async (route) => {
    if (route.request().method() === "PATCH") writes++;
    return route.fallback();
  });
  await page.goto("/admin/pv");
  await page.getByRole("textbox", { name: "Search claims" }).fill("Test Athlete");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Open claim" }).click();
  const editor = page.getByRole("dialog", { name: "Claim review", exact: true });
  await expect(
    editor.getByText(
      "You cannot review your own claim. Another active administrator must decide it.",
    ),
  ).toBeVisible();
  await expect(editor.getByRole("button", { name: "Review decision" })).toHaveCount(0);
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("textbox", { name: "Search claims" }).fill("PV Member 1");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Open claim" }).click();
  await editor.getByRole("combobox", { name: "Decision", exact: true }).selectOption("needs_info");
  await editor.getByRole("button", { name: "Review decision" }).click();
  await expect(editor.getByRole("alert")).toContainText("Give a reason");
  expect(writes).toBe(0);
  await editor.getByLabel("Decision reason", { exact: true }).fill("Please clarify the evidence");
  backend.tables.pv_claims![0]!.note = "Updated source evidence";
  await editor.getByRole("button", { name: "Review decision" }).click();
  const review = page.getByRole("dialog", { name: "Review PV decision", exact: true });
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toContainText("another tab");
  expect(writes).toBe(0);
  await review.getByRole("button", { name: "Keep editing" }).click();
  await expect(editor.getByLabel("Decision reason", { exact: true })).toHaveValue(
    "Please clarify the evidence",
  );
  await editor.getByRole("button", { name: "Reload saved claim" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Discard and reload claim" })
    .click();
  await expect(editor.getByRole("region", { name: "Member evidence" })).toContainText(
    "Updated source evidence",
  );
  await editor.getByRole("combobox", { name: "Decision", exact: true }).selectOption("needs_info");
  await editor.getByLabel("Decision reason", { exact: true }).fill("Please clarify the evidence");
  await editor.getByRole("button", { name: "Review decision" }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  expect(writes).toBe(1);
  expect(backend.tables.pv_ledger).toHaveLength(0);
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("combobox", { name: "Claim status" }).selectOption("needs_info");
  await page.getByRole("button", { name: "Open claim" }).click();
  await expect(editor).toContainText("Saved review feedback");
  await expect(editor.getByLabel("Decision reason", { exact: true })).toHaveValue("");
  backend.tables.user_roles = [{ user_id: userId, role: "member" }];
  await editor.getByRole("button", { name: "Review decision" }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toContainText("administrator access");
  expect(writes).toBe(1);
  expect(fixture.claims[0]!.status).toBe("needs_info");
});

test("PV task management is separate, validates numbers and reviews visibility", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  seedPvReviews(backend);
  let claimReads = 0,
    inserts = 0;
  await context.route("**/rest/v1/pv_claims**", async (route) => {
    claimReads++;
    return route.fallback();
  });
  await context.route("**/rest/v1/pv_tasks**", async (route) => {
    if (route.request().method() === "POST") inserts++;
    return route.fallback();
  });
  await page.goto("/admin/pv?section=tasks");
  await page.getByRole("button", { name: "Create PV task", exact: true }).click();
  expect(claimReads).toBe(0);
  const creator = page.getByRole("dialog", { name: "Create PV task", exact: true });
  await creator.getByLabel("Title (English)", { exact: true }).fill("New accountability task");
  await creator.getByLabel("PV points", { exact: true }).fill("50x");
  await creator.getByRole("button", { name: "Review new PV task" }).click();
  await expect(creator.getByRole("alert")).toContainText("valid number");
  expect(inserts).toBe(0);
  await creator.getByLabel("PV points", { exact: true }).fill("٥٠");
  await creator.getByRole("button", { name: "Review new PV task" }).click();
  const review = page.getByRole("dialog", { name: "Review new PV task", exact: true });
  await expect(review).toContainText("50 PV");
  expect(inserts).toBe(0);
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  await expect(creator).toHaveCount(0);
  expect(inserts).toBe(1);
  const row = page.getByRole("listitem").filter({ hasText: "New accountability task" });
  await row.getByRole("button", { name: "Hide task", exact: true }).click();
  const visibility = page.getByRole("dialog", { name: "Review task visibility", exact: true });
  await visibility.getByRole("button", { name: "Keep editing" }).click();
  expect(
    backend.tables.pv_tasks!.find((r) => r.title_en === "New accountability task")!.active,
  ).toBe(true);
  await row.getByRole("button", { name: "Hide task", exact: true }).click();
  await visibility.getByRole("button", { name: "Confirm changes" }).click();
  await expect(visibility).toHaveCount(0);
  await expect(row).toContainText("Hidden");
  expect(claimReads).toBe(0);
  await page.getByRole("button", { name: "Review queue", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(4);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/admin-pv-queue-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 794 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/admin-pv-queue-ar-mobile.png", fullPage: true });
});

const stableEditorValue = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(stableEditorValue).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${JSON.stringify(k)}:${stableEditorValue(v)}`)
          .join(",")}}`
      : JSON.stringify(value);
function seedProgramEditor(backend: Awaited<ReturnType<typeof fakeBackend>>) {
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  const program = crypto.randomUUID(),
    member = crypto.randomUUID();
  backend.tables.profiles!.push({
    ...backend.tables.profiles![0],
    id: member,
    display_name: "Program member",
    email: "program-member@test.invalid",
  });
  backend.tables.programs = [
    {
      id: program,
      name: "Editable strength",
      weeks: 2,
      description: null,
      created_by: userId,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    },
  ];
  backend.tables.program_items = [
    {
      id: crypto.randomUUID(),
      program_id: program,
      exercise_id: exerciseId,
      week: 1,
      day: 1,
      target_sets: 3,
      target_reps: "8-12",
      position: 0,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: crypto.randomUUID(),
      program_id: program,
      exercise_id: secondExercise,
      week: 2,
      day: 2,
      target_sets: 4,
      target_reps: "6-8",
      position: 0,
      created_at: "2026-10-01T00:00:00Z",
    },
  ];
  backend.tables.program_versions = [];
  backend.tables.program_assignments = [];
  return { program, member };
}
function editorSnapshot(backend: Awaited<ReturnType<typeof fakeBackend>>, id: string) {
  const items = backend.tables.program_items!.filter((r) => r.program_id === id),
    used = new Set(items.map((r) => r.exercise_id));
  return {
    program: backend.tables.programs!.find((p) => p.id === id),
    items: [...items]
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map(({ created_at: _created, ...row }) => row),
    exercises: backend.tables
      .exercises!.filter((e) => used.has(e.id))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((e) =>
        Object.fromEntries(
          [
            "id",
            "name_en",
            "name_ar",
            "muscle",
            "equipment",
            "logging_mode",
            "load_convention",
          ].map((k) => [k, e[k]]),
        ),
      ),
  };
}
async function mockProgramEditor(
  context: BrowserContext,
  backend: Awaited<ReturnType<typeof fakeBackend>>,
  loseResponses = false,
) {
  let failCopy = loseResponses,
    losePublish = loseResponses,
    loseAssignment = loseResponses;
  const calls = { copy: 0, publish: 0, assignment: 0 };
  await context.route("**/rest/v1/rpc/review_program_draft", async (route) => {
    const input = route.request().postDataJSON(),
      current = editorSnapshot(backend, input._program);
    if (stableEditorValue(current) !== stableEditorValue(input._expected))
      return route.fulfill({
        status: 409,
        json: { message: "Program preview changed; reload and review again" },
      });
    if (input._action === "copy") {
      calls.copy++;
      if (failCopy) {
        failCopy = false;
        return route.fulfill({ status: 503, json: { message: "Copy unavailable" } });
      }
      const source = backend.tables.program_items!.filter(
        (r) => r.program_id === input._program && r.week === 1,
      );
      backend.tables.program_items = backend.tables.program_items!.filter(
        (r) => r.program_id !== input._program || r.week === 1,
      );
      for (let week = 2; week <= Number(current.program!.weeks); week++)
        for (const row of source)
          backend.tables.program_items.push({ ...row, id: crypto.randomUUID(), week });
      return route.fulfill({ json: { copied: true } });
    }
    calls.publish++;
    const items = backend.tables
      .program_items!.filter((r) => r.program_id === input._program)
      .sort(
        (a, b) =>
          Number(a.week) - Number(b.week) ||
          Number(a.day) - Number(b.day) ||
          Number(a.position) - Number(b.position) ||
          String(a.id).localeCompare(String(b.id)),
      )
      .map((row) => {
        const ex = backend.tables.exercises!.find((e) => e.id === row.exercise_id)!;
        return {
          ...Object.fromEntries(
            ["id", "exercise_id", "week", "day", "target_sets", "target_reps", "position"].map(
              (k) => [k, row[k]],
            ),
          ),
          ...Object.fromEntries(
            ["name_en", "name_ar", "muscle", "equipment", "logging_mode", "load_convention"].map(
              (k) => [k, ex[k]],
            ),
          ),
        };
      });
    let version = backend.tables.program_versions!.find(
      (v) =>
        v.program_id === input._program && stableEditorValue(v.items) === stableEditorValue(items),
    );
    if (!version) {
      version = {
        id: crypto.randomUUID(),
        program_id: input._program,
        version: backend.tables.program_versions!.length + 1,
        name: current.program!.name,
        weeks: current.program!.weeks,
        description: current.program!.description,
        created_at: new Date().toISOString(),
        created_by: userId,
        items,
      };
      backend.tables.program_versions!.push(version);
    }
    if (losePublish) {
      losePublish = false;
      return route.abort("connectionfailed");
    }
    return route.fulfill({ json: { version_id: version.id } });
  });
  await context.route("**/rest/v1/rpc/review_program_assignment", async (route) => {
    calls.assignment++;
    const input = route.request().postDataJSON(),
      active = backend.tables.program_assignments!.find(
        (r) => r.member_id === input._member && r.active,
      );
    if (active?.program_version_id === input._version) return route.fulfill({ json: active.id });
    if ((active?.id ?? null) !== input._expected)
      return route.fulfill({
        status: 409,
        json: { message: "Active assignment changed; reload and review again" },
      });
    for (const row of backend.tables.program_assignments!)
      if (row.member_id === input._member) row.active = false;
    const version = backend.tables.program_versions!.find((v) => v.id === input._version)!,
      row = {
        id: crypto.randomUUID(),
        program_id: version.program_id,
        program_version_id: version.id,
        member_id: input._member,
        active: true,
        assigned_by: userId,
        start_date: "2026-10-30",
        created_at: new Date().toISOString(),
      };
    backend.tables.program_assignments!.push(row);
    if (loseAssignment) {
      loseAssignment = false;
      return route.abort("connectionfailed");
    }
    return route.fulfill({ json: row.id });
  });
  return calls;
}

test("shop queue finds old requests and lost rejection responses never refund twice", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  const rewardId = crypto.randomUUID(),
    member = crypto.randomUUID(),
    target = crypto.randomUUID();
  backend.tables.profiles!.push({
    ...backend.tables.profiles![0],
    id: member,
    display_name: "Late queue member",
    email: "late@test.invalid",
  });
  backend.tables.rewards = [
    {
      id: rewardId,
      title_en: "Coach review",
      title_ar: "مراجعة المدرب",
      cost_pv: 75,
      stock: 0,
      active: true,
      created_by: userId,
      description: null,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    },
  ];
  backend.tables.redemptions = Array.from({ length: 1005 }, () => ({
    id: crypto.randomUUID(),
    reward_id: rewardId,
    member_id: userId,
    cost_pv: 50,
    status: "pending",
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-10-01T00:00:00Z",
  }));
  backend.tables.redemptions.push({
    id: target,
    reward_id: rewardId,
    member_id: member,
    cost_pv: 50,
    status: "pending",
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-10-01T00:00:00Z",
  });
  let writes = 0,
    lose = true,
    failQueue = false;
  await context.route("**/rest/v1/redemptions**", async (route) => {
    if (route.request().method() === "GET" && failQueue)
      return route.fulfill({ status: 503, json: { message: "Queue unavailable" } });
    if (route.request().method() !== "PATCH") return route.fallback();
    writes++;
    if (lose) {
      lose = false;
      const row = backend.tables.redemptions!.find((r) => r.id === target)!;
      Object.assign(row, route.request().postDataJSON(), {
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      });
      backend.tables.pv_ledger = [
        {
          id: crypto.randomUUID(),
          redemption_id: target,
          source: "refund",
          member_id: member,
          points: 50,
        },
      ];
      backend.tables.rewards![0]!.stock = 1;
      return route.abort("connectionfailed");
    }
    return route.fallback();
  });
  await page.goto("/admin/shop");
  await page.getByRole("textbox", { name: "Search shop", exact: true }).fill("Late queue member");
  // Search narrows the cards, not the complete status-scoped queue total.
  const queueTotal = page
    .getByLabel("Shop overview", { exact: true })
    .getByRole("definition")
    .nth(2);
  await expect(queueTotal).toHaveText("1006");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Late queue member" })
    .getByRole("button", { name: "Review request", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Fulfillment request", exact: true });
  await editor.getByRole("button", { name: "Review rejection / refund", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("rejection reason");
  await editor.getByRole("textbox", { name: "Review note", exact: true }).fill("Stock unavailable");
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  failQueue = true;
  await page.getByRole("button", { name: "Refresh shop", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Complete shop records could not be loaded");
  await expect(queueTotal).toHaveText("—");
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Late queue member" })
      .getByRole("button", { name: "Review request", exact: true }),
  ).toBeDisabled();
  failQueue = false;
  await page.getByRole("button", { name: "Refresh shop", exact: true }).click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Late queue member" })
      .getByRole("button", { name: "Review request", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Reward catalogue", exact: true }).click();
  await page.getByRole("button", { name: "Fulfillment queue", exact: true }).click();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Late queue member" })
    .getByRole("button", { name: "Review request", exact: true })
    .click();
  await expect(editor.getByRole("textbox", { name: "Review note", exact: true })).toHaveValue(
    "Stock unavailable",
  );
  await editor.getByRole("button", { name: "Review rejection / refund", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review fulfillment decision", exact: true });
  await expect(review).toContainText("50 PV");
  await expect(review).toContainText("original charged points");
  await review.getByRole("button", { name: "Keep editing" }).click();
  expect(writes).toBe(0);
  await editor.getByRole("button", { name: "Review rejection / refund", exact: true }).click();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toBeVisible();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  expect(writes).toBe(1);
  expect(backend.tables.pv_ledger).toHaveLength(1);
  expect(backend.tables.rewards![0]!.stock).toBe(1);
  await page
    .getByRole("combobox", { name: "Fulfillment status", exact: true })
    .selectOption("rejected");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Fulfillment status", exact: true })).toHaveValue(
    "rejected",
  );
  await page
    .getByRole("listitem")
    .filter({ hasText: "Late queue member" })
    .getByRole("button", { name: "Review request", exact: true })
    .click();
  await expect(editor).toContainText("Stock unavailable");
  await expect(editor.getByRole("button", { name: "Review fulfillment", exact: true })).toHaveCount(
    0,
  );
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 794 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({
      path: "artifacts/admin-shop-queue-ar.png",
      fullPage: true,
      animations: "disabled",
    });
  // Desktop rows retain the original charged price and open the same reviewed record.
  await page.setViewportSize({ width: 1280, height: 900 });
  const queueTable = page.getByRole("table", { name: "طلبات التسليم", exact: true });
  await expect(queueTable.getByRole("row")).toHaveCount(2);
  await expect(queueTable.getByRole("cell", { name: "50", exact: true })).toBeVisible();
  await queueTable.getByRole("button", { name: "مراجعة الطلب", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "طلب التسليم", exact: true })).toContainText(
    "Stock unavailable",
  );
});

test("shop catalogue creation validates stock, retains uncertain requests and guards visibility", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  let inserts = 0,
    lose = true,
    orders = 0;
  await context.route("**/rest/v1/redemptions**", (route) => {
    orders++;
    return route.fallback();
  });
  await context.route("**/rest/v1/rewards**", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    inserts++;
    if (lose) {
      lose = false;
      const data = route.request().postDataJSON();
      backend.tables.rewards = [
        {
          ...data,
          active: true,
          description: null,
          stock: 0,
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-01T00:00:00Z",
        },
      ];
      return route.abort("connectionfailed");
    }
    return route.fallback();
  });
  await page.goto("/admin/shop?section=catalogue");
  await page.getByRole("button", { name: "Create reward", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Create reward", exact: true });
  await editor.getByLabel("English reward title", { exact: true }).fill("New reward");
  await editor.getByLabel("PV cost", { exact: true }).fill("50x");
  await editor.getByRole("button", { name: "Review new reward", exact: true }).click();
  await expect(editor.getByRole("alert")).toBeVisible();
  expect(inserts).toBe(0);
  await editor.getByLabel("PV cost", { exact: true }).fill("٥٠");
  await editor.getByLabel("Stock (blank = unlimited)", { exact: true }).fill("٠");
  await editor.getByRole("button", { name: "Review new reward", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review new reward", exact: true });
  await expect(review).toContainText("Stock: 0");
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toBeVisible();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  expect(inserts).toBe(1);
  expect(orders).toBe(0);
  await page.getByRole("button", { name: "Hide reward", exact: true }).click();
  const visibility = page.getByRole("dialog", { name: "Review reward visibility", exact: true });
  backend.tables.rewards![0]!.updated_at = "2026-10-02T00:00:00Z";
  await visibility.getByRole("button", { name: "Confirm changes" }).click();
  await expect(visibility.getByRole("alert")).toContainText("Reward changed");
  expect(backend.tables.rewards![0]!.active).toBe(true);
  await visibility.getByRole("button", { name: "Keep editing" }).click();
  await page.getByRole("button", { name: "Refresh shop", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hide reward", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Hide reward", exact: true }).click();
  await visibility.getByRole("button", { name: "Confirm changes" }).click();
  await expect(visibility).toHaveCount(0);
  expect(backend.tables.rewards![0]!.active).toBe(false);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({
      path: "artifacts/admin-shop-catalogue.png",
      fullPage: true,
      animations: "disabled",
    });
  await page.setViewportSize({ width: 1280, height: 900 });
  const catalogueTable = page.getByRole("table", { name: "Reward catalogue", exact: true });
  await expect(catalogueTable.getByRole("row")).toHaveCount(2);
  await catalogueTable.getByRole("button", { name: "Show reward", exact: true }).click();
  await expect(visibility).toContainText("Show for new requests");
  await visibility.getByRole("button", { name: "Keep editing" }).click();
  expect(backend.tables.rewards![0]!.active).toBe(false);
  await page.getByRole("heading", { name: "Reward shop", exact: true }).click();
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/phase6-shop-desktop.png", animations: "disabled" });
});

test("program sessions retain row drafts and review copy, publication and assignment retries", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    fixture = seedProgramEditor(backend),
    calls = await mockProgramEditor(context, backend, true);
  let releaseSessions!: () => void;
  const libraryFirst = new Promise<void>((resolve) => {
    releaseSessions = resolve;
  });
  await context.route("**/rest/v1/program_items**", async (route) => {
    if (route.request().method() === "GET") await libraryFirst;
    await route.fallback();
  });
  const catalogueRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/rest/v1/exercises") &&
      Number(new URL(response.url()).searchParams.get("offset")) > 0,
  );
  await page.goto(`/admin/programs?program=${fixture.program}`);
  const builder = page.getByRole("region", { name: "Program builder", exact: true });
  await catalogueRead;
  await expect(builder).toBeVisible();
  // An incomplete session read is unavailable, not an empty session with zero sets.
  const sessionCount = builder
    .getByText("Session exercises", { exact: true })
    .locator("..")
    .getByRole("definition");
  await expect(sessionCount).toHaveText("—");
  await expect(builder.getByText("Loading exercise library…", { exact: true })).toHaveCount(0);
  releaseSessions();
  await expect(builder.getByText("Bench Press", { exact: true })).toBeVisible();
  await expect(sessionCount).toHaveText("1");
  await builder.getByRole("button", { name: "Edit exercise row", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit session exercise", exact: true });
  await editor.getByLabel("Working sets", { exact: true }).fill("٤");
  await editor.getByLabel("Reps / time target", { exact: true }).fill("10-15");
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await builder.getByRole("combobox", { name: "Week", exact: true }).selectOption("2");
  await builder.getByRole("combobox", { name: "Day", exact: true }).selectOption("2");
  await expect(builder.getByText("Barbell Row", { exact: true })).toBeVisible();
  await expect(builder.getByText("Bench Press", { exact: true })).toHaveCount(0);
  await builder.getByRole("button", { name: /Resume row draft/ }).click();
  await expect(editor.getByLabel("Working sets", { exact: true })).toHaveValue("٤");
  await editor.getByRole("button", { name: "Review session exercise", exact: true }).click();
  const rowReview = page.getByRole("dialog", { name: "Review session exercise", exact: true });
  expect(backend.tables.program_items![0]!.target_sets).toBe(3);
  await rowReview.getByRole("button", { name: "Confirm changes" }).click();
  await expect(editor).toHaveCount(0);
  await expect(
    builder.getByRole("button", { name: "Review publication", exact: true }),
  ).toBeEnabled();
  await builder.getByRole("button", { name: "Review week-one copy", exact: true }).click();
  const copy = page.getByRole("dialog", { name: "Review week-one copy", exact: true });
  await expect(copy).toContainText("replaces all saved rows");
  await copy.getByRole("button", { name: "Keep editing" }).click();
  expect(calls.copy).toBe(0);
  await builder.getByRole("button", { name: "Review week-one copy", exact: true }).click();
  await copy.getByRole("button", { name: "Confirm changes" }).click();
  await expect(copy.getByRole("alert")).toContainText("Copy unavailable");
  await copy.getByRole("button", { name: "Confirm changes" }).click();
  await expect(copy).toHaveCount(0);
  expect(calls.copy).toBe(2);
  expect(backend.tables.program_items!.filter((r) => r.week === 2)).toMatchObject([
    { exercise_id: exerciseId, day: 1, target_sets: 4 },
  ]);
  await builder.getByRole("button", { name: "Review publication", exact: true }).click();
  const publish = page.getByRole("dialog", { name: "Review program publication", exact: true });
  await publish.getByRole("button", { name: "Confirm changes" }).click();
  await expect(publish.getByRole("alert")).toBeVisible();
  await publish.getByRole("button", { name: "Confirm changes" }).click();
  await expect(publish).toHaveCount(0);
  expect(backend.tables.program_versions).toHaveLength(1);
  expect(calls.publish).toBe(2);
  await builder
    .getByRole("combobox", { name: "Member to assign", exact: true })
    .selectOption(fixture.member);
  await builder.getByRole("button", { name: "Review assignment", exact: true }).click();
  const assign = page.getByRole("dialog", { name: "Review program assignment", exact: true });
  await expect(assign).toContainText("Program member");
  await expect(assign).toContainText("No active program");
  await assign.getByRole("button", { name: "Confirm changes" }).click();
  await expect(assign.getByRole("alert")).toBeVisible();
  await assign.getByRole("button", { name: "Confirm changes" }).click();
  await expect(assign).toHaveCount(0);
  expect(backend.tables.program_assignments).toHaveLength(1);
  expect(calls.assignment).toBe(2);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/program-assignments-mobile.png", fullPage: true });
  await builder.getByRole("button", { name: "Session builder", exact: true }).click();
  await builder.getByRole("combobox", { name: "Week", exact: true }).selectOption("2");
  await builder.getByRole("combobox", { name: "Day", exact: true }).selectOption("1");
  await expect(builder.getByText("Bench Press", { exact: true })).toBeVisible();
  await page.reload();
  await expect(builder.getByRole("combobox", { name: "Week", exact: true })).toHaveValue("2");
  await expect(builder.getByRole("combobox", { name: "Day", exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 794 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/program-builder-ar-mobile.png", fullPage: true });
});

test("program review rejects changed previews and new program inputs never clamp invalid weeks", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    fixture = seedProgramEditor(backend);
  await mockProgramEditor(context, backend);
  await page.goto(`/admin/programs?program=${fixture.program}`);
  const builder = page.getByRole("region", { name: "Program builder", exact: true });
  await builder.getByRole("button", { name: "Review week-one copy", exact: true }).click();
  backend.tables.program_items![1]!.target_sets = 9;
  const copy = page.getByRole("dialog", { name: "Review week-one copy", exact: true });
  await copy.getByRole("button", { name: "Confirm changes" }).click();
  await expect(copy.getByRole("alert")).toContainText("preview changed");
  expect(backend.tables.program_items![1]!.target_sets).toBe(9);
  await copy.getByRole("button", { name: "Keep editing" }).click();
  await builder.getByRole("button", { name: "Edit exercise row", exact: true }).click();
  const rowEditor = page.getByRole("dialog", { name: "Edit session exercise", exact: true });
  await rowEditor.getByLabel("Working sets", { exact: true }).fill("5");
  backend.tables.program_items![0]!.target_reps = "12-15";
  await rowEditor.getByRole("button", { name: "Review session exercise", exact: true }).click();
  const staleRow = page.getByRole("dialog", { name: "Review session exercise", exact: true });
  await staleRow.getByRole("button", { name: "Confirm changes" }).click();
  await expect(staleRow.getByRole("alert")).toBeVisible();
  await staleRow.getByRole("button", { name: "Keep editing" }).click();
  await rowEditor.getByRole("button", { name: "Discard row draft", exact: true }).click();
  await page.getByRole("button", { name: "Discard row changes", exact: true }).click();
  await expect(rowEditor.getByLabel("Reps / time target", { exact: true })).toHaveValue("12-15");
  await expect(rowEditor.getByLabel("Working sets", { exact: true })).toHaveValue("3");
  await rowEditor.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Create program", exact: true }).click();
  const creator = page.getByRole("dialog", { name: "Create program", exact: true });
  await creator.getByLabel("Program name", { exact: true }).fill("New program");
  await creator.getByLabel("Weeks", { exact: true }).fill("53");
  await creator.getByRole("button", { name: "Review new program", exact: true }).click();
  await expect(creator.getByRole("alert")).toContainText("at most 52");
  expect(backend.tables.programs).toHaveLength(1);
  await creator.getByLabel("Weeks", { exact: true }).fill("٢");
  await creator.getByRole("button", { name: "Review new program", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Review new program", exact: true })
    .getByRole("button", { name: "Confirm changes" })
    .click();
  await expect(page.getByRole("dialog", { name: "Review new program", exact: true })).toHaveCount(
    0,
  );
  await expect(creator).toHaveCount(0);
  expect(backend.tables.programs).toHaveLength(2);
  await expect(page.getByRole("region", { name: "Program builder", exact: true })).toContainText(
    "New program",
  );
});

test("structured exercise edits keep per-exercise drafts, media boundaries and approved alternatives", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  backend.tables.exercises![0]!.guidance = {
    steps_en: "Original English",
    steps_ar: "الشرح الأصلي",
    editor_note: "Preserve source metadata",
  };
  backend.tables.exercises![0]!.media = {
    url: "https://owned.test.invalid/demo.gif",
    author: "Original coach",
    source: "Coach recording",
    license: "original",
    permission: "Recorded permission",
    attribution: "Original coach",
    poster: "",
  };
  let saves = 0,
    lose = true;
  await context.route("**/rest/v1/exercises**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    saves++;
    if (lose) {
      lose = false;
      const id = new URL(route.request().url()).searchParams.get("id")!.slice(3),
        row = backend.tables.exercises!.find((e) => e.id === id)!;
      Object.assign(row, route.request().postDataJSON(), { updated_at: new Date().toISOString() });
      return route.abort("connectionfailed");
    }
    return route.fallback();
  });
  await page.goto("/admin/exercises");
  const press = page.getByRole("listitem").filter({ hasText: "Bench Press" }),
    row = page.getByRole("listitem").filter({ hasText: "Barbell Row" });
  await press.getByRole("button", { name: "Edit exercise", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit exercise", exact: true });
  await editor.getByRole("button", { name: "Guidance", exact: true }).click();
  await editor
    .getByLabel("English steps, one per line", { exact: true })
    .fill("Draft English press");
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await row.getByRole("button", { name: "Edit exercise", exact: true }).click();
  await editor.getByRole("button", { name: "Guidance", exact: true }).click();
  await expect(editor.getByLabel("English steps, one per line", { exact: true })).toHaveValue("");
  await editor.getByRole("button", { name: "Media rights", exact: true }).click();
  await expect(editor.getByLabel("HTTPS media URL", { exact: true })).toHaveValue("");
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await press.getByRole("button", { name: "Edit exercise", exact: true }).click();
  await expect(editor.getByLabel("English steps, one per line", { exact: true })).toHaveValue(
    "Draft English press",
  );
  await editor.getByRole("button", { name: "Classification", exact: true }).click();
  await editor.getByLabel("Equipment tags, comma separated", { exact: true }).fill("barbell");
  await editor.getByLabel("Movement classification", { exact: true }).fill("horizontal_push");
  await editor.getByLabel("Reviewed bilingual guidance and rights", { exact: true }).check();
  await editor.getByRole("button", { name: "Review exercise changes", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review exercise changes", exact: true });
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review.getByRole("alert")).toBeVisible();
  await review.getByRole("button", { name: "Confirm changes" }).click();
  await expect(review).toHaveCount(0);
  expect(saves).toBe(1);
  expect(backend.tables.exercises![0]!.guidance).toMatchObject({
    steps_en: "Draft English press",
    editor_note: "Preserve source metadata",
  });
  expect(backend.tables.exercises![0]!.editorial_status).toBe("reviewed");
  await editor.getByRole("button", { name: "Alternatives", exact: true }).click();
  await editor
    .getByRole("combobox", { name: "Alternative exercise", exact: true })
    .selectOption(secondExercise);
  await editor
    .getByLabel("Equipment explanation in English", { exact: true })
    .fill("Use the available barbell setup");
  await editor.getByLabel("Arabic explanation", { exact: true }).fill("استخدم البار المتاح");
  await editor.getByRole("button", { name: "Review alternative", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Review alternative", exact: true })
    .getByRole("button", { name: "Confirm changes" })
    .click();
  await expect.poll(() => backend.tables.exercise_alternatives?.length).toBe(1);
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await press.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Review exercise visibility", exact: true })
    .getByRole("button", { name: "Confirm changes" })
    .click();
  await expect(press).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Exercise visibility", exact: true })
    .selectOption("archived");
  await expect(press).toHaveCount(1);
  expect(backend.tables.exercises![0]!.guidance).toMatchObject({ steps_en: "Draft English press" });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 794 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "artifacts/exercise-catalogue-ar-mobile.png", fullPage: true });
});

test("catalogue search reaches beyond the REST cap and coverage failures never become zero", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  const base = backend.tables.exercises![0]!;
  backend.tables.exercises = Array.from({ length: 1006 }, (_, i) => ({
    ...base,
    id: crypto.randomUUID(),
    name_en: `Exercise ${String(i).padStart(4, "0")}`,
  }));
  const tail = backend.tables.exercises.at(-1)!;
  tail.name_en = "Curated tail exercise";
  tail.active = false;
  const version = crypto.randomUUID();
  backend.tables.program_versions = [{ id: version, items: [{ exercise_id: tail.id }] }];
  backend.tables.program_assignments = Array.from({ length: 200 }, () => ({
    id: crypto.randomUUID(),
    program_version_id: version,
    active: true,
  }));
  let failed = false,
    reads = 0;
  await context.route("**/rest/v1/program_versions**", async (route) => {
    if (route.request().method() === "GET") {
      reads++;
      if (failed) return route.fulfill({ status: 503, json: { message: "Coverage unavailable" } });
    }
    return route.fallback();
  });
  await page.goto("/admin/exercises");
  await expect(
    page.getByText("Active-program exercise coverage: 1 · Editorial exceptions: 1", {
      exact: true,
    }),
  ).toBeVisible();
  expect(reads).toBe(2);
  await page
    .getByRole("combobox", { name: "Editorial filter", exact: true })
    .selectOption("required");
  await expect(
    page.getByRole("combobox", { name: "Exercise visibility", exact: true }),
  ).toHaveValue("all");
  await page.getByRole("textbox", { name: "Search exercises", exact: true }).fill("Curated tail");
  await expect(page.getByText("Curated tail exercise", { exact: true })).toBeVisible();
  failed = true;
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Coverage is unavailable; it is not zero.");
  await expect(
    page
      .getByRole("combobox", { name: "Editorial filter", exact: true })
      .locator('option[value="required"]'),
  ).toHaveAttribute("disabled", "");
  failed = false;
  await page.getByRole("button", { name: "Retry coverage", exact: true }).click();
  await expect(
    page.getByText("Active-program exercise coverage: 1 · Editorial exceptions: 1", {
      exact: true,
    }),
  ).toBeVisible();
});

async function trainingFeatures(context: BrowserContext, flags: Row) {
  await context.route("**/rest/v1/rpc/get_training_features", (route) =>
    route.fulfill({
      json: {
        guidance: false,
        logging: false,
        progression: false,
        scheduling: false,
        imports: false,
        offline: false,
        ...flags,
      },
    }),
  );
}

test("reward retries reuse a durable request after a lost response and allow a separate purchase", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context),
    reward = crypto.randomUUID();
  backend.tables.rewards = [
    { id: reward, title_en: "Test reward", title_ar: null, cost_pv: 10, stock: 2, active: true },
  ];
  backend.tables.member_pv_totals = [{ member_id: userId, points: 100 }];
  let lost = true;
  const requests: string[] = [];
  await context.route("**/rest/v1/rpc/request_redemption", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body._request);
    let receipt = backend.tables.redemptions?.find((r) => r.id === body._request);
    if (!receipt) {
      receipt = {
        id: body._request,
        reward_id: body._reward,
        member_id: body._member,
        status: "pending",
        cost_pv: body._expected_cost,
        created_at: new Date().toISOString(),
      };
      (backend.tables.redemptions ??= []).push(receipt);
      backend.tables.rewards![0]!.stock = Number(backend.tables.rewards![0]!.stock) - 1;
      backend.tables.member_pv_totals![0]!.points =
        Number(backend.tables.member_pv_totals![0]!.points) - body._expected_cost;
    }
    if (lost) {
      lost = false;
      await route.abort("connectionfailed");
      return;
    }
    await route.fulfill({ json: receipt });
  });

  await page.goto("/rewards?section=shop");
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
  await expect(
    page.getByText("Estimated remaining balance", { exact: true }).locator(".."),
  ).toContainText("90 PV");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(requests).toEqual([]);
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
  if (process.env["PW_UI_SCREENSHOTS"]) {
    await expect(page.getByRole("dialog")).toBeInViewport({ ratio: 0.99 });
    await page.screenshot({
      path: "artifacts/reward-confirmation-mobile.png",
      animations: "disabled",
    });
  }
  await page.getByRole("button", { name: "Confirm reward request", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Unconfirmed reward requests", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request unconfirmed", exact: true }),
  ).toBeDisabled();
  backend.tables.rewards![0]!.cost_pv = 15;
  await page.reload();
  await page.getByRole("button", { name: "Check / retry request", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("not deduct PV again");
  await page.getByRole("button", { name: "Confirm saved request", exact: true }).click();
  // Repricing persists asynchronously; a transient rerender is not a server acknowledgement.
  await expect.poll(() => requests.length).toBe(2);
  await expect(
    page.getByRole("region", { name: "Unconfirmed reward requests", exact: true }),
  ).toHaveCount(0);
  expect(requests[0]).toBe(requests[1]);
  expect(backend.tables.redemptions).toHaveLength(1);
  expect(backend.tables.member_pv_totals![0]!.points).toBe(90);
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
  await page.getByRole("button", { name: "Confirm reward request", exact: true }).click();
  await expect.poll(() => backend.tables.redemptions?.length).toBe(2);
  expect(requests[2]).not.toBe(requests[0]);
  expect(backend.tables.member_pv_totals![0]!.points).toBe(75);
});

test("older photos page independently and comparison pins photos across history pages", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const photos = Array.from({ length: 50 }, (_, i) => ({
    id: crypto.randomUUID(),
    member_id: userId,
    pose: "front",
    taken_on: new Date(Date.UTC(2026, 9, 28 - i)).toISOString().slice(0, 10),
    created_at: new Date(Date.UTC(2026, 9, 28 - i, 12)).toISOString(),
    path: `${userId}/history-${i}.jpg`,
  }));
  backend.tables.progress_photos = photos;
  const batches: string[][] = [];
  await context.route("**/storage/v1/**", async (route) => {
    if (route.request().method() === "POST") {
      const paths = route.request().postDataJSON().paths as string[];
      batches.push(paths);
      await route.fulfill({
        json: paths.map((path) => ({
          path,
          signedURL: `/object/sign/progress-photos/${path}?token=test`,
        })),
      });
    } else
      await route.fulfill({
        contentType: "image/gif",
        body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
      });
  });
  await page.goto("/progress?section=photos");
  await page.getByRole("button", { name: "Slider overlay", exact: true }).click();
  await expect(page.getByRole("slider")).toBeVisible();
  expect(batches.every((b) => b.length <= 30)).toBe(true);
  expect(batches.flat()).not.toContain(photos[30]!.path);
  await page
    .getByRole("navigation", { name: "Photo history pages", exact: true })
    .getByRole("button", { name: "Older photos", exact: true })
    .click();
  await expect(page.getByAltText(`Front ${photos[49]!.taken_on}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Older comparison photos", exact: true }).click();
  await page.getByLabel("Before photo", { exact: true }).selectOption(photos[49]!.id);
  await expect(page.getByAltText(`Before: ${photos[49]!.taken_on}`, { exact: true })).toBeVisible();
  await expect(page.getByAltText(`After: ${photos[0]!.taken_on}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Newer comparison photos", exact: true }).click();
  await expect(page.getByLabel("Before photo", { exact: true })).toHaveValue(photos[49]!.id);
  await page.locator("[data-photo-comparison-filters] summary").click();
  await page.getByLabel("Photos through", { exact: true }).fill("2026-09-30");
  await expect(page.getByLabel("Before photo", { exact: true })).toHaveValue(photos[49]!.id);
});

test("photo query failures show persistent retry controls instead of an empty gallery", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  let fail = true;
  await context.route("**/rest/v1/progress_photos*", (route) =>
    fail
      ? route.fulfill({ status: 503, json: { message: "Photo query unavailable" } })
      : route.fallback(),
  );
  await page.goto("/progress?section=photos");
  await expect(
    page.getByRole("alert").filter({ hasText: "Photos could not be loaded." }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Photo history could not be loaded." }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("button", { name: "Retry photo history", exact: true }).click();
  await page.getByRole("button", { name: "Slider overlay", exact: true }).click();
  await expect(page.getByRole("slider")).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Photos could not be loaded." }),
  ).toHaveCount(0);
});

test("offline caching retains complete older body history while online", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { offline: true });
  backend.tables.body_measurements = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      measured_on: "2026-09-01",
      weight_kg: 70,
      waist_cm: 80,
      body_fat_pct: 15,
      revision: 1,
    },
  ];
  await page.goto("/progress?section=body");
  await page.setViewportSize({ width: 1024, height: 850 });
  await expect(page.getByRole("columnheader", { name: "Weight (kg)", exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "2026-09-01" })).toContainText("70");
});
test("coach workout history uses frozen exercise names after catalogue renaming", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  const session = crypto.randomUUID(),
    slot = crypto.randomUUID();
  backend.tables.exercises![0]!.name_en = "Renamed catalogue exercise";
  backend.tables.workout_sessions = [
    {
      id: session,
      member_id: userId,
      title: "Historical workout",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      origin: "native",
    },
  ];
  backend.tables.workout_exercises = [
    { id: slot, snapshot: { name_en: "Original Bench Press", name_ar: "البنش الأصلي" } },
  ];
  backend.tables.set_logs = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      session_id: session,
      exercise_id: exerciseId,
      workout_exercise_id: slot,
      reps: 8,
      weight_kg: 40,
      set_role: "working",
      side: "bilateral",
    },
  ];
  await page.goto(`/members/${userId}?section=training`);
  await page.getByRole("button", { name: "View sets · Historical workout", exact: true }).click();
  await expect(page.getByText(/Original Bench Press/)).toBeVisible();
});
test("MIT guidance keeps provenance and branded media stays in internal preview", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { guidance: true });
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  let mediaRequests = 0;
  await context.route(
    "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/**",
    (route) => {
      mediaRequests++;
      const gif = route.request().url().endsWith(".gif"),
        file = `artifacts/exercise-preview-source/${gif ? "gif" : "image"}`;
      const body = existsSync(file)
        ? readFileSync(file)
        : Buffer.from(
            gif
              ? "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
              : "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/e0AAAAASUVORK5CYII=",
            "base64",
          );
      return route.fulfill({ body, contentType: gif ? "image/gif" : "image/jpeg" });
    },
  );
  await page.goto("/admin/exercises");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Bench Press" })
    .getByRole("button", { name: "Edit exercise", exact: true })
    .click();
  await page.getByRole("button", { name: "Guidance", exact: true }).click();
  await page.getByText("Use MIT exercise text library", { exact: true }).click();
  await page.getByLabel("Search reference exercises", { exact: true }).fill("barbell bench press");
  await page
    .getByRole("button", { name: "Preview reference: barbell bench press", exact: true })
    .click();
  expect(mediaRequests).toBe(0);
  await page.getByRole("button", { name: "Preview Prime Vanguard styling", exact: true }).click();
  const preview = page.getByRole("region", { name: "Prime Vanguard media preview", exact: true });
  const illustration = preview.getByRole("img", { name: /barbell bench press/ });
  await expect(illustration).toBeVisible();
  await expect
    .poll(() => illustration.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(mediaRequests).toBe(1);
  await page.getByRole("button", { name: "Play GIF", exact: true }).click();
  await expect(illustration).toHaveAttribute("src", /\.gif$/);
  await expect.poll(() => mediaRequests).toBe(2);
  await page.getByRole("button", { name: "Stop demonstration", exact: true }).click();
  await expect(illustration).toHaveAttribute("src", /\.(jpg|jpeg|png)$/);
  await preview.screenshot({ path: "artifacts/exercise-brand-preview.png" });
  await page.getByRole("button", { name: "Use draft English guidance", exact: true }).click();
  await expect(page.getByLabel("English steps, one per line", { exact: true })).not.toHaveValue("");
  await expect(
    page.getByLabel("Reviewed bilingual guidance and rights", { exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Review exercise changes", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Review exercise changes", exact: true })
    .getByRole("button", { name: "Confirm changes" })
    .click();
  await expect
    .poll(() => backend.tables.exercises!.find((e) => e.id === exerciseId)?.guidance)
    .toMatchObject({
      text_source: { repository: "hasaneyldrm/exercises-dataset", license: "MIT" },
    });
  expect(backend.tables.exercises!.find((e) => e.id === exerciseId)?.media).toBeNull();
});

test("full exercise catalogue can page, search Arabic and keep cardio out of strength sets", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { guidance: true, logging: true });
  const reference = JSON.parse(readFileSync("public/data/exercise-reference.json", "utf8")) as {
    exercises: {
      id: string;
      name: string;
      target: string;
      equipment: string;
      steps_en: string[];
    }[];
  };
  const arabic = JSON.parse(readFileSync("public/data/exercise-arabic.json", "utf8")) as {
    exercises: { id: string; name_ar: string; steps_ar: string[] }[];
  };
  backend.tables.exercises!.push(
    ...reference.exercises.map((e, n) => ({
      id: `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      name_en: e.name,
      name_ar: arabic.exercises[n]!.name_ar,
      muscle: e.target,
      equipment: e.equipment,
      equipment_tags: [e.equipment],
      active: true,
      logging_mode: "bodyweight_reps",
      load_convention: "bodyweight",
      editorial_status: "needs_review",
      guidance: {
        steps_en: e.steps_en.join("\n"),
        steps_ar: arabic.exercises[n]!.steps_ar.join("\n"),
        translation: { status: "machine_draft" },
        catalogue_kind: e.target === "cardiovascular system" ? "cardio" : "strength",
      },
    })),
  );
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  const library = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Exercise library", exact: true }) });
  await library
    .getByRole("navigation", { name: "Exercise views", exact: true })
    .getByRole("button", { name: "All", exact: true })
    .click();
  await expect(
    library.getByRole("list", { name: "Exercise results", exact: true }).locator(":scope > li"),
  ).toHaveCount(12);
  await library.getByRole("button", { name: /Show more exercises/ }).click();
  await expect(
    library.getByRole("list", { name: "Exercise results", exact: true }).locator(":scope > li"),
  ).toHaveCount(24);
  const last = arabic.exercises.at(-1)!;
  await library
    .getByRole("searchbox", { name: "Search exercises", exact: true })
    .fill(last.name_ar);
  await expect(
    library.getByRole("button", { name: new RegExp(`^${reference.exercises.at(-1)!.name}`) }),
  ).toBeVisible();
  await library
    .getByRole("searchbox", { name: "Search exercises", exact: true })
    .fill("stationary bike walk");
  await expect(
    library.getByRole("list", { name: "Exercise results", exact: true }).getByRole("listitem"),
  ).toHaveCount(0);
  await expect(
    library.getByRole("button", { name: "Insert selected exercises", exact: true }),
  ).toBeDisabled();
  await expect(library.getByText(/Cardio activities are logged separately/)).toBeVisible();
  expect(backend.tables.set_logs).toHaveLength(0);
});

for (const locale of ["en", "ar"] as const) {
  test(`guidance and finish actions stay reachable on small screens in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    await trainingFeatures(context, { guidance: true, logging: true });
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    backend.tables.exercises![0] = {
      ...backend.tables.exercises![0],
      editorial_status: "reviewed",
      guidance: {
        steps_en: Array.from(
          { length: 24 },
          (_, i) => `Step ${i + 1}: follow the written setup.`,
        ).join("\n"),
        steps_ar: Array.from({ length: 24 }, (_, i) => `خطوة ${i + 1}: اتبع تعليمات الإعداد.`).join(
          "\n",
        ),
        cues_en: "Keep a controlled movement.",
        cues_ar: "تحكم في الحركة.",
        mistakes_en: "Avoid rushing.",
        mistakes_ar: "تجنب التسرع.",
      },
    };
    let alternativesAvailable = false;
    await context.route("**/rest/v1/exercise_alternatives?*", (route) =>
      route.fulfill(
        alternativesAvailable ? { json: [] } : { status: 400, json: { message: "Unavailable" } },
      ),
    );
    await page.setViewportSize({ width: 320, height: 420 });
    await page.goto("/train");
    await page
      .getByRole("button", { name: l("Start workout", "ابدأ التمرين"), exact: true })
      .click();
    await page
      .getByRole("button", { name: l("Exercise options", "خيارات التمرين"), exact: true })
      .click();
    await page
      .getByRole("button", { name: l("Instructions", "طريقة الأداء"), exact: true })
      .click();
    const guidance = page.locator("[data-stitch-exercise-detail]");
    const back = guidance.getByRole("button", {
      name: l("Return to workout", "العودة إلى التمرين"),
      exact: true,
    });
    await expect(back).toBeInViewport();
    await guidance.locator("[data-exercise-guidance-scroll]").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const retry = guidance.getByRole("button", {
      name: l("Retry alternatives", "إعادة تحميل البدائل"),
      exact: true,
    });
    await expect(retry).toBeVisible({ timeout: 15000 });
    alternativesAvailable = true;
    await retry.click();
    await expect(guidance).toContainText(
      l("No coach-approved alternatives listed.", "لا توجد بدائل معتمدة حالياً."),
    );
    await expect(
      guidance.getByRole("heading", { name: l("Execution cues", "إرشادات الأداء"), exact: true }),
    ).toBeVisible();
    await expect(back).toBeInViewport();
    expect(
      await guidance.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1);
    await guidance.screenshot({ path: `artifacts/guidance-small-${locale}.png` });
    await back.click();
    await page.getByLabel("kg", { exact: true }).fill("25.5");
    await page.getByLabel(l("Reps", "التكرارات"), { exact: true }).fill("8");
    await page.getByRole("button", { name: l("Log set", "سجّل"), exact: true }).click();
    await page
      .getByRole("button", { name: l("Finish workout", "إنهاء التمرين"), exact: true })
      .click();
    const review = page.getByRole("dialog");
    const save = review.getByRole("button", {
      name: l("Save workout", "حفظ التمرين"),
      exact: true,
    });
    await expect(save).toBeInViewport();
    await review.locator("[data-workout-review-scroll]").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(save).toBeInViewport();
    await expect(review).toContainText("204 kg");
    expect(
      await review.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1);
    await review.screenshot({ path: `artifacts/finish-small-${locale}.png` });
    await review.getByRole("button", { name: l("Cancel", "تراجع"), exact: true }).click();
    await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
    expect(backend.tables.workout_sessions![0]!.finished_at).toBeFalsy();
    // A failed local finish must retain both the review and the original logged set.
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
        if (this.name === "workouts" && args[0]?.phase === "finishing") {
          IDBObjectStore.prototype.put = original;
          throw new DOMException("Device storage is full", "QuotaExceededError");
        }
        return original.apply(this, args);
      };
    });
    await page
      .getByRole("button", { name: l("Finish workout", "إنهاء التمرين"), exact: true })
      .click();
    await save.click();
    await expect(review.getByRole("alert")).toContainText("Device storage is full");
    await expect(review.getByRole("alert")).toBeInViewport();
    expect(backend.tables.workout_sessions![0]!.finished_at).toBeFalsy();
    await save.click();
    await expect(
      page.getByRole("button", { name: l("Start workout", "ابدأ التمرين"), exact: true }),
    ).toBeVisible();
    expect(backend.tables.set_logs).toHaveLength(1);
    expect(backend.tables.workout_sessions![0]!.finished_at).toBeTruthy();
    const complete = page.locator("[data-workout-complete]");
    await expect(complete).toContainText("204 kg");
    await expect(complete).toContainText(
      l("Workout complete · synced", "اكتمل التمرين · تمت المزامنة"),
    );
    await page.reload();
    await expect(complete).toContainText("204 kg");
    for (const size of [
      { width: 320, height: 420 },
      { width: 390, height: 844 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(size);
      expect(
        await complete.evaluate((element) => element.scrollWidth - element.clientWidth),
      ).toBeLessThanOrEqual(1);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await complete.screenshot({ path: `artifacts/workout-complete-${locale}.png` });
    await complete
      .getByRole("link", { name: l("View completed workout", "عرض التمرين المكتمل"), exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`session=${backend.tables.workout_sessions![0]!.id}`));
    await page.goto("/train");
    await complete
      .getByRole("button", { name: l("Dismiss summary", "إغلاق الملخص"), exact: true })
      .click();
    await page.reload();
    await expect(complete).toHaveCount(0);
    expect(backend.tables.set_logs).toHaveLength(1);
  });
}

test("program completion stays visible without changing the selected training section", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const version = crypto.randomUUID();
  backend.tables.program_assignments = [
    { id: crypto.randomUUID(), member_id: userId, program_version_id: version, active: true },
  ];
  backend.tables.program_versions = [
    {
      id: version,
      name: "Completion regression",
      version: 1,
      weeks: 1,
      items: [
        {
          id: crypto.randomUUID(),
          exercise_id: exerciseId,
          week: 1,
          day: 1,
          position: 0,
          target_sets: 1,
          target_reps: "8",
          name_en: "Bench Press",
          name_ar: "ضغط الصدر",
          muscle: "chest",
          equipment: "barbell",
          logging_mode: "weighted_reps",
          load_convention: "external_total",
        },
      ],
    },
  ];
  await page.goto("/train?section=program");
  await page.getByRole("button", { name: "Start this day", exact: true }).click();
  const row = page.getByRole("group", { name: "Planned set 1", exact: true });
  await row.getByLabel("kg", { exact: true }).fill("50");
  await row.getByLabel("Reps", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Log set 1", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  const complete = page.locator("[data-workout-complete]");
  await expect(complete).toContainText("400 kg");
  await expect(
    page
      .getByRole("navigation", { name: "Training sections", exact: true })
      .getByRole("button", { name: "My program", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(complete).toContainText("400 kg");
  const explanation = complete.locator("details");
  await expect(explanation).not.toHaveAttribute("open", "");
  await explanation.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(explanation).toHaveAttribute("open", "");
  await expect(explanation.getByText(/Volume includes working and drop segments/)).toBeVisible();
  expect(backend.tables.workout_sessions).toHaveLength(1);
  expect(backend.tables.set_logs).toHaveLength(1);
});

test("offline finish waits for server acceptance before showing the durable completion summary", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20000 })
    .toBe(true);
  await context.setOffline(true);
  await page.getByLabel("kg", { exact: true }).fill("100");
  await page.getByLabel("Reps", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(
    page.getByText(
      "Workout saved. Waiting for the server to confirm. Rewards update after confirmation.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator("[data-workout-complete]")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("[data-workout-complete]")).toHaveCount(0);
  expect(backend.tables.set_logs).toHaveLength(0);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("[data-workout-complete]")).toContainText("500 kg");
  await expect
    .poll(() => backend.tables.workout_sessions!.filter((row) => row.finished_at).length)
    .toBe(1);
  const id = backend.tables.workout_sessions![0]!.id;
  await page.reload();
  await expect(page.locator("[data-workout-complete]")).toContainText("500 kg");
  expect(backend.tables.set_logs).toHaveLength(1);
  expect(backend.tables.workout_sessions).toHaveLength(1);
  expect(backend.tables.workout_sessions![0]!.id).toBe(id);
});

test("workout names are set at start, changed mid-workout and renamed in history", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await page.goto("/train");
  await page.getByLabel("Workout name (optional)", { exact: true }).fill("  Push day  ");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Push day", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rename workout", exact: true }).click();
  const sheet = page.getByRole("dialog");
  const field = sheet.getByLabel("Workout name", { exact: true });
  await expect(field).toHaveValue("Push day");
  await field.fill("   ");
  await sheet.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(sheet.getByRole("alert")).toContainText("1–80");
  await field.fill("Upper A");
  await sheet.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Upper A", exact: true })).toBeVisible();
  await page.getByLabel("kg", { exact: true }).fill("60");
  await page.getByLabel("Reps", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect
    .poll(() =>
      backend.tables.workout_sessions!.filter((row) => row.finished_at).map((row) => row.title),
    )
    .toEqual(["Upper A"]);
  await page.goto("/train?section=history");
  await page.getByRole("button", { name: "Rename workout: Upper A", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Workout name", { exact: true }).fill("Upper A heavy");
  await page.getByRole("dialog").getByRole("button", { name: "Save name", exact: true }).click();
  await expect.poll(() => backend.tables.workout_sessions![0]!.title).toBe("Upper A heavy");
  await expect(page.getByText("Upper A heavy", { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Rename workout: Upper A heavy", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save name", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Connect to the internet to rename this workout.",
  );
  await context.setOffline(false);
});

test("an unnamed workout is saved with the muscles it trained", async ({ page, context }) => {
  const backend = await fakeBackend(context);
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.getByLabel("kg", { exact: true }).fill("60");
  await page.getByLabel("Reps", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  expect(title).not.toBe("Workout");
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect
    .poll(() => backend.tables.workout_sessions!.find((row) => row.finished_at)?.title)
    .toBe(title);
});

test("exercise guidance and timed working sets survive reload", async ({ page, context }) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { guidance: true, logging: true });
  backend.tables.exercises![1] = {
    ...backend.tables.exercises![1],
    name_en: "Plank",
    equipment: "bodyweight",
    equipment_tags: ["bodyweight"],
    logging_mode: "timed",
    load_convention: "bodyweight",
    editorial_status: "reviewed",
    guidance: {
      steps_en: "Keep a steady position.\nBreathe normally.",
      steps_ar: "حافظ على الثبات.",
    },
  };
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await chooseFromLibrary(page, "Plank");
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page.getByRole("button", { name: "Instructions", exact: true }).click();
  await expect(page.getByText("Breathe normally.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Seconds", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Add effort (RPE)", exact: true }).click();
  await page.getByLabel("RPE 1–10", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs!.length).toBe(1);
  expect(backend.tables.set_logs![0]).toMatchObject({
    reps: null,
    duration_seconds: 30,
    logging_mode: "timed",
    set_role: "working",
  });
  await page.reload();
  await expect(
    page.getByRole("list", { name: "Completed sets" }).getByText("30s", { exact: true }),
  ).toBeVisible();
});

test("offline meals water body and wellness survive refresh then sync once", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { offline: true });
  await page.goto("/progress?section=body");
  await page.getByRole("button", { name: "Add measurements", exact: true }).click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto("/nutrition");
  await expect(page.getByText("0 / 2500 ml", { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByLabel("Calories", { exact: true }).fill("500");
  await page.getByLabel("Protein", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByRole("button", { name: "+250 ml", exact: true }).click();
  await expect(page.getByText("250 / 2500 ml", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await page.getByRole("button", { name: "Body", exact: true }).click();
  await page.getByRole("button", { name: "Add measurements", exact: true }).click();
  await page.getByLabel("Weight kg", { exact: true }).fill("80");
  await page.getByRole("button", { name: "Save measurement", exact: true }).click();
  await page.getByLabel("Sleep hours", { exact: true }).fill("7");
  await page.getByLabel("Energy 1–5", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Save check-in on device", exact: true }).click();
  await expect(page.getByText("4 entries saved on this device", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText("4 entries saved on this device", { exact: false })).toBeVisible();
  expect(backend.tables.food_logs).toHaveLength(0);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => backend.tables.food_logs!.length).toBe(1);
  await expect.poll(() => backend.tables.water_logs!.length).toBe(1);
  await expect.poll(() => backend.tables.body_measurements?.length).toBe(1);
  await expect.poll(() => backend.tables.wellness_checkins?.length).toBe(1);
  await page.reload();
  expect(backend.tables.food_logs).toHaveLength(1);
  expect(backend.tables.wellness_checkins).toHaveLength(1);
});

test("Strong CSV preview requires review and import is duplicate safe", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { imports: true });
  await page.goto("/profile?section=privacy");
  const csv =
    "Date,Workout Name,Exercise Name,Set Order,Weight,Reps,Seconds,Notes\n2026-10-20 10:00:00,Imported bench,Bench Press,1,40,10,,steady";
  await page
    .getByLabel("Workout CSV file", { exact: true })
    .setInputFiles({ name: "strong.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("button", { name: "4. Import", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "I reviewed mapping and existing history for overlapping workouts. Similar workouts are not automatically merged.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Continue to import", exact: true }).click();
  backend.loseImportResponse();
  await page.getByRole("button", { name: "Confirm import / retry", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Accepted chunks remain saved");
  await expect(page.getByRole("button", { name: "2. Mapping", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Confirm import / retry", exact: true }).click();
  await expect(page.getByText("Import complete:", { exact: false })).toBeVisible();
  expect(backend.tables.workout_sessions).toHaveLength(1);
  expect(backend.tables.workout_sessions![0]!.origin).toBe("import");
  await page.getByRole("button", { name: "Reset preview", exact: true }).click();
  await page
    .getByLabel("Workout CSV file", { exact: true })
    .setInputFiles({ name: "strong-again.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "I reviewed mapping and existing history for overlapping workouts. Similar workouts are not automatically merged.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Continue to import", exact: true }).click();
  await page.getByRole("button", { name: "Confirm import / retry", exact: true }).click();
  await expect(page.getByText("1 duplicates skipped", { exact: false })).toBeVisible();
  expect(backend.tables.workout_sessions).toHaveLength(1);
  expect(backend.tables.xp_events ?? []).toHaveLength(0);
});

test("import exclusions require fresh review and receipt retries preserve reviewed undo", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { imports: true });
  let receiptUnavailable = true;
  let undoCalls = 0;
  let blockReceiptReads = false;
  await context.route("**/rest/v1/rpc/get_import_batch_outcome", async (route) => {
    // The initial commit needs its durable receipt; simulate a later read failure.
    if (blockReceiptReads && receiptUnavailable) {
      await route.fulfill({ status: 503, json: { message: "Receipt temporarily unavailable" } });
      return;
    }
    await route.fallback();
  });
  await context.route("**/rest/v1/rpc/undo_training_import", async (route) => {
    expect(route.request().postDataJSON()._batch).toBe(backend.tables.import_batches![0]!.id);
    undoCalls++;
    await route.fulfill({ json: { removed: 0, edited: 1 } });
  });
  await page.goto("/profile?section=privacy");
  const csv =
    "Date,Workout Name,Exercise Name,Set Order,Weight,Reps,Seconds,Notes\n2026-10-20 10:00:00,Partial import,Bench Press,1,40,10,,steady\n2026-10-20 10:00:00,Partial import,Occupied press,2,20,8,,review";
  await page
    .getByLabel("Workout CSV file", { exact: true })
    .setInputFiles({ name: "partial.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("button", { name: "Review import", exact: true })).toBeDisabled();
  await page.getByRole("combobox", { name: "Occupied press", exact: true }).selectOption("skip");
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  const consent = page.getByRole("checkbox", {
    name: "I reviewed mapping and existing history for overlapping workouts. Similar workouts are not automatically merged.",
    exact: true,
  });
  await consent.check();
  await expect(
    page.getByRole("button", { name: "Continue to import", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "I accept the listed exclusions / unknown times.", exact: true })
    .check();
  await page.getByRole("button", { name: "2. Mapping", exact: true }).click();
  await page.getByRole("combobox", { name: "Bench Press", exact: true }).selectOption("skip");
  await expect(page.getByRole("button", { name: "Review import", exact: true })).toBeDisabled();
  await page.getByRole("combobox", { name: "Bench Press", exact: true }).selectOption(exerciseId);
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await expect(consent).not.toBeChecked();
  await consent.check();
  await page.getByRole("button", { name: "Continue to import", exact: true }).click();
  await page.getByRole("button", { name: "Confirm import / retry", exact: true }).click();
  await expect(page.getByText("Import complete: 1 added", { exact: false })).toBeVisible();
  expect(backend.tables.set_logs).toHaveLength(1);
  expect(backend.tables.workout_sessions![0]!.origin).toBe("import");
  expect(backend.tables.xp_events ?? []).toHaveLength(0);
  blockReceiptReads = true;
  await page.getByText("Recent import receipts", { exact: true }).click();
  await page.getByText("Durable outcome", { exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Receipt unavailable; retry when connected." }),
  ).toBeVisible({ timeout: 15000 });
  receiptUnavailable = false;
  await page.getByRole("button", { name: "Retry receipt", exact: true }).click();
  await expect(
    page.getByText("1 accepted · 0 duplicates skipped · 1 chunks", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo unchanged workouts", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Keep editing", exact: true }).click();
  expect(undoCalls).toBe(0);
  await page.getByRole("button", { name: "Undo unchanged workouts", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm changes", exact: true })
    .click();
  await expect(page.getByText("1 edited workouts retained", { exact: false })).toBeVisible();
  expect(undoCalls).toBe(1);
  expect(backend.tables.workout_sessions).toHaveLength(1);
});

test("multi-chunk import retry reports the durable total across acknowledged and uncertain chunks", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { imports: true });
  await page.goto("/profile?section=privacy");
  const csv =
    "Date,Workout Name,Exercise Name,Set Order,Weight,Reps,Seconds,Notes\n" +
    Array.from(
      { length: 101 },
      (_, i) => `2026-10-20 10:00:00,Import session ${i},Bench Press,1,40,10,,steady`,
    ).join("\n");
  await page
    .getByLabel("Workout CSV file", { exact: true })
    .setInputFiles({ name: "sessions.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "I reviewed mapping and existing history for overlapping workouts. Similar workouts are not automatically merged.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Continue to import", exact: true }).click();
  backend.loseImportResponse(2);
  await page.getByRole("button", { name: "Confirm import / retry", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Accepted chunks remain saved");
  expect(backend.tables.workout_sessions).toHaveLength(101);
  await page.getByRole("button", { name: "Confirm import / retry", exact: true }).click();
  await expect(page.getByText("Import complete: 101 added", { exact: false })).toBeVisible();
  expect(backend.tables.workout_sessions).toHaveLength(101);
  await expect(page.getByText("2 durably recorded chunks", { exact: true })).toBeVisible();
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({
      path: "artifacts/import-receipt-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
});

test("sync recovery compares fields and reviews choices before retaining server data", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  await trainingFeatures(context, { offline: true });
  await page.goto("/nutrition");
  await expect(page.getByText("0 / 2500 ml", { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.getByRole("button", { name: "+250 ml", exact: true }).click();
  await expect(page.getByText("1 entries saved on this device", { exact: false })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("prime-fitness-member-data", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("members", "readwrite"),
        store = tx.objectStore("members"),
        keys = store.getAllKeys();
      keys.onsuccess = () => {
        const key = keys.result[0]!,
          get = store.get(key);
        get.onsuccess = () => {
          const state = get.result,
            m = state.queue[0];
          m.status = "conflict";
          m.error = "A newer water entry exists";
          m.server_revision = 2;
          m.server = { ...m.payload, ml: 500, revision: 2 };
          store.put(state, key);
        };
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  const panel = page.getByRole("region", { name: "Member sync", exact: true });
  await expect(panel.getByText(/^Water \(ml\)/)).toBeVisible();
  await expect(panel.getByText("250", { exact: true })).toBeVisible();
  await expect(panel.getByText("500", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Keep server", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review conflict choice", exact: true });
  await expect(review).toContainText("discard this record’s unsynced device changes");
  await review.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(panel.getByText(/^Water \(ml\)/)).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 794 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({
      path: "artifacts/sync-conflict-ar-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
  await page
    .getByRole("region", { name: "مزامنة السجلات", exact: true })
    .getByRole("button", { name: "اعتماد الخادم", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "مراجعة حل التعارض", exact: true })
    .getByRole("button", { name: "تأكيد التغييرات", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "مزامنة السجلات", exact: true })).toHaveCount(0);
  await expect(page.getByText(/^500\s*\/\s*2500/)).toBeVisible();
});

test("coach configures progression and rotation without rewriting a frozen plan", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { progression: true, scheduling: true });
  backend.tables.user_roles = [{ user_id: userId, role: "admin" }];
  const assignment = "00000000-0000-4000-8000-000000000080",
    version = "00000000-0000-4000-8000-000000000081",
    slot = "00000000-0000-4000-8000-000000000082",
    occurrence = "00000000-0000-4000-8000-000000000083";
  const item = {
    id: slot,
    exercise_id: exerciseId,
    week: 1,
    day: 1,
    target_sets: 3,
    target_reps: "8-12",
    position: 0,
    name_en: "Bench Press",
    name_ar: null,
    muscle: "chest",
    equipment: "barbell",
  };
  backend.tables.program_assignments = [
    { id: assignment, member_id: userId, program_version_id: version, active: true },
  ];
  backend.tables.program_versions = [
    { id: version, name: "Coached plan", version: 1, weeks: 1, items: [item] },
  ];
  await context.route("**/rest/v1/rpc/configure_program_schedule", async (route) => {
    const r = route.request().postDataJSON();
    backend.tables.program_schedules = [
      { assignment_id: assignment, member_id: userId, mode: r._mode, start_date: r._start },
    ];
    backend.tables.session_occurrences = [
      {
        id: occurrence,
        assignment_id: assignment,
        member_id: userId,
        program_version_id: version,
        week: 1,
        day: 1,
        ordinal: 1,
        due_date: null,
        status: "scheduled",
      },
    ];
    await route.fulfill({ json: null });
  });
  await context.route("**/rest/v1/rpc/start_session_occurrence", async (route) => {
    const r = route.request().postDataJSON();
    let session = backend.tables.workout_sessions!.find((s) => s.occurrence_id === occurrence);
    if (!session) {
      session = {
        id: r._session,
        member_id: userId,
        started_at: r._started,
        finished_at: null,
        occurrence_id: occurrence,
        origin: "native",
      };
      backend.tables.workout_sessions!.push(session);
      backend.tables.session_occurrences![0]!.status = "in_progress";
    }
    await route.fulfill({ json: session });
  });
  await page.goto(`/members/${userId}?section=training`);
  await page.getByLabel("Schedule mode", { exact: true }).selectOption("rotation");
  await page.getByRole("button", { name: "Save schedule", exact: true }).click();
  await page.getByRole("button", { name: "Confirm coaching changes", exact: true }).click();
  await expect.poll(() => backend.tables.program_schedules?.[0]?.mode).toBe("rotation");
  await page
    .getByRole("combobox", { name: "Program exercise slot", exact: true })
    .selectOption(slot);
  await page.getByLabel("Progression rule", { exact: true }).selectOption("double");
  await page.getByRole("button", { name: "Save progression policy", exact: true }).click();
  await page.getByRole("button", { name: "Confirm coaching changes", exact: true }).click();
  await expect.poll(() => backend.tables.training_policies?.length).toBe(1);
  expect(backend.tables.training_policies![0]).toMatchObject({
    rule: "double",
    slot_key: `${version}:${slot}`,
  });
  expect(backend.tables.program_versions![0]!.items).toEqual([item]);
  await page.goto("/train");
  await expect(
    page.getByRole("navigation", { name: "Training sections", exact: true }).getByRole("button"),
  ).toHaveCount(3);
  await expect(page.locator("[data-scheduled-preview] [data-exercise-hero]")).toBeVisible();
  await expect(page.locator("[data-scheduled-preview]")).toContainText(item.name_en);
  await expect(page.locator("[data-scheduled-preview] [data-session-exercises] > li")).toHaveCount(
    1,
  );
  await expect(page.getByRole("button", { name: "Start session", exact: true })).toHaveCount(1);
  const agenda = page.getByRole("button", { name: "View agenda", exact: true });
  await agenda.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Hide agenda", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("button", { name: "Move W1 D1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide agenda", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start session", exact: true })).toHaveCount(1);
  await page.screenshot({ path: "artifacts/stitch-scheduled-preview.png", fullPage: true });
  await page.getByRole("button", { name: "Start session", exact: true }).click();
  await expect.poll(() => backend.tables.workout_sessions!.length).toBe(1);
  expect(backend.tables.workout_sessions![0]!.occurrence_id).toBe(occurrence);
});

test("two tabs preserve both sets and failed local writes are never reported as saved", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log set", exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto("/train");
  await expect(second.getByRole("button", { name: "Log set", exact: true })).toBeVisible();
  await page.getByLabel("Reps", { exact: true }).fill("5");
  await second.getByLabel("Reps", { exact: true }).fill("8");
  await Promise.all([
    page.getByRole("button", { name: "Log set", exact: true }).click(),
    second.getByRole("button", { name: "Log set", exact: true }).click(),
  ]);
  await expect.poll(() => backend.tables.set_logs!.length).toBe(2);
  expect(new Set(backend.tables.set_logs!.map((row) => row.id)).size).toBe(2);
  await second.close();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      IDBObjectStore.prototype.put = original;
      throw new DOMException("Device storage is full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect(page.getByText("Device storage is full", { exact: true })).toBeVisible();
  expect(backend.tables.set_logs).toHaveLength(2);
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page.getByRole("button", { name: "Retry sync" }).click();
  await page.keyboard.press("Escape");
  await expect.poll(() => backend.tables.set_logs!.length).toBe(3);
});

for (const locale of ["en", "ar"] as const) {
  test(`measurement cards distinguish loading failure and empty history in ${locale}`, async ({
    page,
    context,
  }) => {
    await fakeBackend(context, locale);
    await trainingFeatures(context, { offline: false });
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    let fail = true;
    await context.route("**/rest/v1/body_measurements**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await delayed;
      if (fail) await route.fulfill({ status: 400, json: { message: "Synthetic read failure" } });
      else await route.fallback();
    });
    try {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/progress?section=body", { waitUntil: "domcontentloaded" });
      const body = page.locator("[data-stitch-body-workspace]");
      await expect(
        body
          .getByRole("status")
          .filter({ hasText: locale === "ar" ? "جارٍ تحميل القياسات…" : "Loading measurements…" }),
      ).toBeVisible();
      await expect(body.locator("[data-stitch-body-metrics]")).toHaveCount(0);
      release();
      const retry = body.getByRole("button", {
        name: locale === "ar" ? "إعادة تحميل القياسات" : "Retry measurements",
      });
      await expect(retry).toBeVisible({ timeout: 15000 });
      await expect(
        body.getByText(
          locale === "ar" ? "غير متاح في السجل المحمّل" : "Not available in loaded history",
        ),
      ).toHaveCount(3);
      await expect(
        body.getByText(locale === "ar" ? "لم يُسجّل" : "Not recorded", { exact: true }),
      ).toHaveCount(0);
      fail = false;
      await retry.click();
      await expect(
        body.getByText(locale === "ar" ? "لم يُسجّل" : "Not recorded", { exact: true }),
      ).toHaveCount(3);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    } finally {
      release();
    }
  });

  test(`muscle volume retries failed reads and retains the selected view in ${locale}`, async ({
    page,
    context,
  }) => {
    await fakeBackend(context, locale);
    let fail = true;
    await context.route("**/rest/v1/set_logs**", async (route) => {
      const select = new URL(route.request().url()).searchParams.get("select") ?? "";
      if (
        fail &&
        route.request().method() === "GET" &&
        select.includes("workout_exercises(snapshot)")
      )
        await route.fulfill({ status: 400, json: { message: "Synthetic read failure" } });
      else await route.fallback();
    });
    await page.goto("/progress");
    const volume = page.locator("[data-stitch-muscle-volume]");
    const retry = volume.getByRole("button", {
      name: locale === "ar" ? "إعادة تحميل حجم التدريب" : "Retry weekly volume",
    });
    await expect(retry).toBeVisible({ timeout: 15000 });
    await expect(volume.locator("[data-muscle-controls]")).toHaveCount(0);
    fail = false;
    await retry.click();
    const back = volume.getByRole("button", { name: locale === "ar" ? /^الظهر/ : /^Back/ });
    await back.click();
    await expect(back).toHaveAttribute("aria-pressed", "true");
    fail = true;
    await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
    await expect(volume.getByRole("alert")).toContainText(
      locale === "ar" ? "آخر النتائج" : "last loaded results",
      { timeout: 15000 },
    );
    await expect(back).toHaveAttribute("aria-pressed", "true");
    fail = false;
    await retry.click();
    await expect(volume.getByRole("alert")).toHaveCount(0);
    await expect(back).toHaveAttribute("aria-pressed", "true");
  });
}

test("photo comparison has keyboard slider and mobile layouts fit in both languages", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  // Supply private photo URLs without contacting real storage.
  await context.route("**/storage/v1/object/public/**", async (route) => {
    await route.fulfill({ path: "public/icon-512.png", contentType: "image/png" });
  });
  await page.goto("/progress?section=photos");
  await page.getByRole("button", { name: "Slider overlay", exact: true }).click();
  await page.getByLabel("Drag to reveal · Before / After").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Drag to reveal · Before / After")).toHaveValue("51");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "This week's muscle volume" })).toBeVisible();
  const muscleVolume = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "This week's muscle volume", exact: true }) });
  await expect(muscleVolume.getByText("Front view", { exact: true })).toBeVisible();
  await expect(muscleVolume.getByText("Back view", { exact: true })).toBeVisible();
  await muscleVolume.locator('svg path[id="quadriceps"]').first().click();
  await expect(muscleVolume.getByRole("button", { name: /^Quads/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await muscleVolume.getByRole("button", { name: /^Chest/ }).focus();
  await page.keyboard.press("Enter");
  await expect(muscleVolume.getByRole("button", { name: /^Chest/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/muscle-diagram-en.png", fullPage: true });
  await page.getByRole("button", { name: "Photos", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/progress-mobile.png", fullPage: true });
  await page.evaluate(() => localStorage.setItem("pf-locale", "ar"));
  // Avoid overriding the test's initial language on reload.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "ملخص", exact: true }).click();
  const front = page.getByText("الواجهة الأمامية", { exact: true });
  const back = page.getByText("الواجهة الخلفية", { exact: true });
  await expect(front).toBeVisible();
  await expect(back).toBeVisible();
  expect((await front.boundingBox())!.x).toBeLessThan((await back.boundingBox())!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/muscle-diagram-ar.png", fullPage: true });
});

test("imperial logger stores kg and shows lb plate tools", async ({ page, context }) => {
  const backend = await fakeBackend(context);
  backend.tables.profiles![0]!.units = "imperial";
  await page.goto("/train");
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.getByLabel("Reps", { exact: true }).fill("5");
  await page.getByLabel("lb", { exact: true }).fill("225");
  await page.getByRole("button", { name: "Exercise options", exact: true }).click();
  await page.getByRole("button", { name: "Plates & warm-up" }).click();
  await expect(page.getByText("45 + 2 \u00d7 90 = 225 lb")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Exercise options", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect.poll(() => backend.tables.set_logs?.[0]?.weight_kg).toBe(102.06);
});

test("complete progress includes the PR after the first thousand sets", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const completed = crypto.randomUUID(),
    unfinished = crypto.randomUUID();
  backend.tables.workout_sessions = [
    {
      id: completed,
      member_id: userId,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    },
    { id: unfinished, member_id: userId, started_at: new Date().toISOString(), finished_at: null },
  ];
  backend.tables.set_logs = Array.from({ length: 1105 }, (_, i) => ({
    id: crypto.randomUUID(),
    member_id: userId,
    exercise_id: exerciseId,
    session_id: completed,
    reps: 5,
    weight_kg: i === 1104 ? 150 : 80,
    created_at: new Date(2026, 0, 1, 0, i).toISOString(),
  }));
  backend.tables.set_logs.push({
    id: crypto.randomUUID(),
    member_id: userId,
    session_id: unfinished,
    exercise_id: exerciseId,
    reps: 1,
    weight_kg: 999,
    created_at: new Date().toISOString(),
  });
  await page.goto("/progress");
  // Assert the real metric value with its current accessible card and number format.
  await expect(
    page
      .locator("[data-stitch-progress-metrics] > div")
      .filter({ hasText: "Logged set entries" })
      .getByRole("definition")
      .first(),
  ).toHaveText("1,105");
  await page.getByRole("button", { name: "Strength", exact: true }).click();
  await expect(page.getByText("150 kg \u00d7 5", { exact: true })).toBeVisible();
});

test("streak includes more than sixty days", async ({ page, context }) => {
  const backend = await fakeBackend(context);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  const start = Date.parse(`${today}T12:00:00Z`);
  backend.tables.member_activity_days = Array.from({ length: 90 }, (_, i) => ({
    member_id: userId,
    activity_date: new Date(start - i * 86400000).toISOString().slice(0, 10),
  }));
  await page.goto("/today");
  // The redesigned streak presents its count and label as one heading.
  await expect(page.getByRole("heading", { name: "90-day streak", exact: true })).toBeVisible();
});

for (const locale of ["en", "ar"] as const) {
  test(`weekly quests show server rewards and the campaign bonus in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    const quest = (name: string, progress: number, goal: number, awarded: boolean) => ({
      week_start: "2026-11-30",
      quest: name,
      progress,
      goal,
      xp: name === "week" ? 750 : 250,
      awarded,
      pays: true,
    });
    backend.tables.my_weekly_quests = [
      quest("workouts", 3, 3, true),
      quest("nutrition", 2, 5, false),
      quest("body", 1, 1, false),
      quest("week", 2, 3, false),
    ];
    await page.goto("/today");
    const reward = (key: string) => page.locator(`[data-quest-reward="${key}"]`);
    await expect(reward("q_workouts")).toHaveText("+250 XP");
    await expect(reward("q_nutrition")).toHaveText("+250 XP");
    // Done but not yet confirmed by the server.
    await expect(reward("q_body")).toHaveText(l("+250 XP after sync", "+250 XP بعد المزامنة"));
    await expect(
      page.getByText(
        l("Finish all three for a campaign bonus:", "أنجز الثلاث لمكافأة حملة الأسبوع:"),
      ),
    ).toBeVisible();

    backend.tables.my_weekly_quests = [
      quest("workouts", 3, 3, true),
      quest("nutrition", 5, 5, true),
      quest("body", 1, 1, true),
      quest("week", 3, 3, true),
    ];
    await page.reload();
    await expect(page.locator("[data-quest-campaign]")).toHaveText(
      l(
        "Campaign complete: +750 XP. New quests start Monday.",
        "اكتملت حملة الأسبوع: +750 XP. مهام جديدة يوم الاثنين.",
      ),
    );
    await expect(reward("q_body")).toHaveText("+250 XP");
  });
}

const paidCampaign = ["workouts", "nutrition", "body", "week"].map((quest) => ({
  week_start: "2026-11-30",
  quest,
  progress: quest === "nutrition" ? 5 : quest === "week" ? 3 : quest === "body" ? 1 : 3,
  goal: quest === "nutrition" ? 5 : quest === "body" ? 1 : 3,
  xp: quest === "week" ? 750 : 250,
  awarded: true,
  pays: true,
}));

for (const locale of ["en", "ar"] as const) {
  test(`campaign complete plays once per paid week in ${locale}`, async ({ page, context }) => {
    const backend = await fakeBackend(context, locale);
    backend.tables.my_weekly_quests = paidCampaign;
    await page.goto("/today");
    const seal = page.locator("[data-campaign-seal]");
    await expect(seal).toBeVisible();
    await expect(seal).toContainText("+750 XP");
    // Decorative: hidden from assistive technology, never blocks taps.
    await expect(seal).toHaveAttribute("aria-hidden", "true");
    await expect(seal).toBeHidden({ timeout: 6000 });
    await page.reload();
    await expect(page.locator("[data-quest-campaign]")).toBeVisible();
    await expect(seal).toHaveCount(0);
  });
}

test("campaign complete stays still when celebrations are off", async ({ page, context }) => {
  const backend = await fakeBackend(context);
  backend.tables.my_weekly_quests = paidCampaign;
  await context.addInitScript(() => localStorage.setItem("pf-celebrations", "off"));
  await page.goto("/today");
  await expect(page.locator("[data-quest-campaign]")).toContainText("Campaign complete");
  await expect(page.locator("[data-campaign-seal]")).toHaveCount(0);
});

test("campaign complete plays once per tab when storage is blocked", async ({ page, context }) => {
  const backend = await fakeBackend(context);
  backend.tables.my_weekly_quests = paidCampaign;
  await context.addInitScript(() => {
    const { getItem, setItem } = Storage.prototype;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith("pf-campaign-seen")) throw new DOMException("blocked", "SecurityError");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("pf-campaign-seen")) throw new DOMException("blocked", "SecurityError");
      return setItem.call(this, key, value);
    };
  });
  await page.goto("/today");
  const seal = page.locator("[data-campaign-seal]");
  await expect(seal).toBeVisible();
  await expect(seal).toBeHidden({ timeout: 6000 });
  await page.getByRole("link", { name: "Nutrition", exact: true }).click();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page.locator("[data-quest-campaign]")).toBeVisible();
  await expect(seal).toHaveCount(0);
});

test("backup preview restores missing logs and rejects another owner", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.progress_photos = [];
  backend.tables.food_logs = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      log_date: "2026-10-25",
      created_at: "2026-10-25T10:00:00Z",
      meal: "snack",
      name: "Saved meal",
      calories: 500,
      protein_g: 40,
      carbs_g: 50,
      fat_g: 10,
    },
  ];
  await page.goto("/profile?section=privacy");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download full backup (JSON)", exact: true }).click();
  const download = await downloadEvent;
  const backup = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(backup.data.food_logs).toHaveLength(1);
  backend.tables.food_logs = [];
  const file = (value: unknown) => ({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  });
  await page.getByLabel("Choose backup to review").setInputFiles(file(backup));
  await expect(page.getByText(/Restore preview/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restore missing personal data", exact: true }),
  ).toBeDisabled();
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({
      path: "artifacts/backup-restore-preview-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
  await page
    .getByRole("checkbox", {
      name: "I reviewed the owner, record counts and pending changes. Add missing records without replacing existing history.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Restore missing personal data", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Missing personal records restored." }),
  ).toBeVisible();
  expect(backend.tables.food_logs).toHaveLength(1);
  await page
    .getByLabel("Choose backup to review")
    .setInputFiles(file({ ...backup, ownerId: secondExercise }));
  await expect(
    page.getByRole("alert").filter({ hasText: "different account or project" }),
  ).toBeVisible();
});

test("assigned program retains its frozen exercises after reload", async ({ page, context }) => {
  const backend = await fakeBackend(context);
  const version = crypto.randomUUID();
  backend.tables.exercises![0]!.active = false;
  backend.tables.exercises![0]!.name_en = "Edited draft exercise";
  backend.tables.program_assignments = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      program_version_id: version,
      active: true,
      created_at: new Date().toISOString(),
    },
  ];
  backend.tables.program_versions = [
    {
      id: version,
      program_id: crypto.randomUUID(),
      version: 7,
      name: "Frozen Routine",
      description: null,
      weeks: 2,
      created_by: userId,
      created_at: new Date().toISOString(),
      items: [
        {
          id: crypto.randomUUID(),
          exercise_id: exerciseId,
          week: 1,
          day: 1,
          target_sets: 3,
          target_reps: "8",
          position: 0,
          name_en: "Frozen Bench",
          name_ar: null,
          muscle: "chest",
          equipment: "barbell",
        },
      ],
    },
  ];
  await page.goto("/train");
  await page.getByRole("button", { name: "My program", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Frozen Routine", exact: true })).toBeVisible();
  await expect(page.getByText("Program version 7", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start this day", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Frozen Bench/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: /^Frozen Bench/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("approved rank emblems cache offline and appear in the exported story", async ({
  page,
  context,
}) => {
  await context.addInitScript(() =>
    Object.defineProperty(document.fonts, "ready", { get: () => new Promise(() => {}) }),
  );
  await fakeBackend(context);
  await page.goto("/rewards");
  const map = page.getByLabel("100-level journey map", { exact: true });
  for (const rank of ["Recruit", "Seeker", "Forged", "Guardian", "Vanguard", "Prime Legend"]) {
    const emblem = map.getByRole("img", { name: `${rank} rank emblem`, exact: true });
    await expect(emblem).toHaveCount(1);
    await expect
      .poll(() =>
        emblem.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
      )
      .toBe(true);
    await expect(emblem).toHaveAttribute("srcset", /128w, .*256w, .*512w/);
  }
  await page.getByRole("button", { name: "Level 91 Locked", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Level 91 · Prime Legend", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/rank-emblems-mobile.png", fullPage: true });
  const cachedEmblems = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const result: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys()) {
        if (
          /(recruit|seeker|forged|guardian|vanguard|prime-legend)-(128|256|512)-.*\.webp$/.test(
            request.url,
          )
        )
          result.push(request.url);
      }
    return [...new Set(result)];
  });
  expect(cachedEmblems).toHaveLength(18);
  await context.setOffline(true);
  expect(
    await page.evaluate(
      async (urls) =>
        (await Promise.all(urls.map(async (url) => (await fetch(url)).ok))).every(Boolean),
      cachedEmblems,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Share achievement", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download PNG", exact: true })).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG", exact: true }).click();
  const download = await downloading;
  const base64 = readFileSync((await download.path())!).toString("base64");
  const result = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    // Only the emblem region: this fails if export silently omits the new art.
    const pixels = ctx.getImageData(340, 500, 400, 400).data;
    let gold = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i]! > 110 && pixels[i + 1]! > 65 && pixels[i]! > pixels[i + 2]! * 1.3) gold++;
    return { width: image.width, height: image.height, gold };
  }, base64);
  expect(result.width).toBe(1080);
  expect(result.height).toBe(1920);
  expect(result.gold).toBeGreaterThan(6000);
  await context.setOffline(false);
});

for (const locale of ["en", "ar"] as const) {
  test(`onboarding setup remains responsive through review in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    Object.assign(backend.tables.profiles[0], { onboarding_completed: false, display_name: "" });
    const ar = locale === "ar";
    await page.setViewportSize({ width: 393, height: 1067 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/onboarding");
    await expect(page.locator("[data-onboarding-welcome]")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    if (process.env["PW_ONBOARDING_CAPTURE"])
      await page.screenshot({
        path: `artifacts/onboarding-${process.env["PW_ONBOARDING_CAPTURE"]}-${locale}-welcome.png`,
        fullPage: true,
      });
    await page
      .getByRole("button", { name: ar ? "بدء الإعداد" : "Begin setup", exact: true })
      .click();
    await page
      .getByLabel(ar ? "الاسم الظاهر" : "Display name", { exact: true })
      .fill("Test Athlete");
    await page.getByRole("button", { name: ar ? "رجوع" : "Back", exact: true }).click();
    await expect(page.locator("[data-onboarding-welcome]")).toBeVisible();
    await page
      .getByRole("button", { name: ar ? "بدء الإعداد" : "Begin setup", exact: true })
      .click();
    await expect(
      page.getByLabel(ar ? "الاسم الظاهر" : "Display name", { exact: true }),
    ).toHaveValue("Test Athlete");
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 1067 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
    await page.setViewportSize({ width: 393, height: 1067 });
    if (process.env["PW_ONBOARDING_CAPTURE"])
      await page.screenshot({
        path: `artifacts/onboarding-${process.env["PW_ONBOARDING_CAPTURE"]}-${locale}-profile.png`,
        fullPage: true,
      });
    await page.getByRole("button", { name: ar ? "متابعة" : "Continue", exact: true }).click();
    const preferences = page.locator("[data-onboarding-training-preferences]");
    await expect(preferences).toBeVisible();
    const imperial = preferences.locator('input[value="imperial"]');
    await imperial.check();
    await expect(preferences.locator('[aria-live="polite"]')).toContainText("132.28 lb");
    const effort = preferences.locator("summary");
    await effort.focus();
    await page.keyboard.press("Enter");
    await expect(preferences.locator("details")).toHaveAttribute("open", "");
    for (const width of [320, 393, 768, 1280]) {
      await page.setViewportSize({ width, height: 1067 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
    await page.setViewportSize({ width: 393, height: 1067 });
    // ResizeObserver updates the decorative marker on the next animation frame.
    // Wait for its real bounds before using a full-page image as visual evidence.
    await expect
      .poll(async () =>
        preferences.locator("[data-section-slider]").evaluate((marker) => {
          const selected = marker.parentElement?.querySelector("label:has(input:checked)");
          return (
            !!selected &&
            Math.abs(
              marker.getBoundingClientRect().width - selected.getBoundingClientRect().width,
            ) < 1
          );
        }),
      )
      .toBe(true);
    if (process.env["PW_ONBOARDING_CAPTURE"])
      await page.screenshot({
        path: `artifacts/onboarding-training-${locale}.png`,
        fullPage: true,
      });
    await page.getByRole("button", { name: ar ? "رجوع" : "Back", exact: true }).click();
    await page.getByRole("button", { name: ar ? "متابعة" : "Continue", exact: true }).click();
    await expect(preferences.locator('input[value="imperial"]')).toBeChecked();
    await page.getByRole("button", { name: ar ? "متابعة" : "Continue", exact: true }).click();
    const heading = page.getByRole("heading", {
      name: ar ? "المراجعة والموافقة" : "Review & consent",
    });
    await expect(heading).toBeFocused();
    await expect(
      page.getByRole("button", {
        name: ar ? "ادخل Prime Fitness" : "Enter Prime Fitness",
        exact: true,
      }),
    ).toBeDisabled();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    if (process.env["PW_ONBOARDING_CAPTURE"])
      await page.screenshot({
        path: `artifacts/onboarding-${process.env["PW_ONBOARDING_CAPTURE"]}-${locale}-consent.png`,
        fullPage: true,
      });
    await page
      .getByRole("checkbox", { name: ar ? "أفهم وأوافق" : "I understand and agree" })
      .check();
    await expect(
      page.getByRole("button", {
        name: ar ? "ادخل Prime Fitness" : "Enter Prime Fitness",
        exact: true,
      }),
    ).toBeEnabled();
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`optional onboarding device setup handles install outcomes in ${locale}`, async ({
    page,
    context,
  }) => {
    await fakeBackend(context, locale);
    const ar = locale === "ar";
    await page.setViewportSize({ width: 393, height: 850 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: ar ? "اكتمل إعداد حسابك" : "Your setup is complete" }),
    ).toBeFocused();
    if (process.env["PW_ONBOARDING_CAPTURE"])
      await page.screenshot({ path: `artifacts/onboarding-ready-${locale}.png`, fullPage: true });
    await page
      .getByRole("button", { name: ar ? "التطبيق والإشعارات" : "App & notifications", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(
      page.getByText(
        ar
          ? "تنبيهات الدفع في الخلفية والتذكيرات المجدولة غير متاحة بعد."
          : "Background push alerts and scheduled reminders are not available yet.",
        { exact: true },
      ),
    ).toBeVisible();
    const installation = page.getByRole("region", {
      name: ar ? "تثبيت التطبيق" : "App installation",
      exact: true,
    });
    await expect(installation.getByRole("button")).toHaveCount(0);
    for (const width of [320, 393, 768, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
    await page.setViewportSize({ width: 393, height: 850 });
    if (process.env["PW_ONBOARDING_CAPTURE"])
      await page.screenshot({ path: `artifacts/onboarding-device-${locale}.png`, fullPage: true });
    for (const outcome of ["dismissed", "failed", "accepted"]) {
      await page.evaluate((outcome) => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        Object.assign(event, {
          prompt: async () => {
            if (outcome === "failed") throw new Error("Synthetic prompt failure");
          },
          userChoice: Promise.resolve({ outcome }),
        });
        window.dispatchEvent(event);
      }, outcome);
      await installation
        .getByRole("button", {
          name: ar ? "تثبيت برايم فيتنس" : "Install Prime Fitness",
          exact: true,
        })
        .click();
      if (outcome === "failed") await expect(installation.getByRole("alert")).toBeVisible();
      else
        await expect(installation.getByRole("status")).toContainText(
          outcome === "accepted"
            ? ar
              ? "تم طلب التثبيت"
              : "Installation requested"
            : ar
              ? "تم تخطي التثبيت"
              : "Installation skipped",
        );
      await expect(
        installation.getByText(ar ? "يعمل كتطبيق مثبت" : "Running as an installed app", {
          exact: true,
        }),
      ).toHaveCount(0);
    }
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(installation.getByRole("status")).toContainText(
      ar ? "يعمل كتطبيق مثبت" : "Running as an installed app",
    );
    await page
      .getByRole("button", {
        name: ar ? "العودة إلى شاشة الاستعداد" : "Return to ready screen",
        exact: true,
      })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(
      page.getByRole("link", { name: ar ? "الانتقال إلى اليوم" : "Go to Today", exact: true }),
    ).toBeVisible();
  });
}

for (const locale of ["en", "ar"] as const) {
  test(`full onboarding persists coaching context and reaches the app in ${locale}`, async ({
    page,
    context,
  }) => {
    const backend = await fakeBackend(context, locale);
    Object.assign(backend.tables.profiles[0], { onboarding_completed: false, display_name: "" });
    const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/onboarding");
    await page.getByRole("button", { name: l("Begin setup", "بدء الإعداد"), exact: true }).click();
    await page
      .getByLabel(l("Display name", "الاسم الظاهر"), { exact: true })
      .fill("Synthetic Athlete");
    await page.getByRole("button", { name: l("Continue", "متابعة"), exact: true }).click();
    await page.getByRole("checkbox", { name: l("Strength", "القوة"), exact: true }).check();
    await page
      .getByRole("radio", { name: l("Novice (0–1 year)", "مبتدئ (0–1 سنة)"), exact: true })
      .check();
    await page
      .getByLabel(l("Available training days per week", "أيام التدريب المتاحة أسبوعياً"))
      .selectOption("3");
    await page.getByRole("checkbox", { name: l("Dumbbells", "دمبل"), exact: true }).check();
    await page.getByRole("button", { name: l("Continue", "متابعة"), exact: true }).click();
    await expect(
      page.getByRole("region", {
        name: l("Saved training preferences", "تفضيلات التدريب المحفوظة"),
      }),
    ).toContainText(l("Strength", "القوة"));
    await page.getByRole("checkbox", { name: l("I understand and agree", "أفهم وأوافق") }).check();
    await page
      .getByRole("button", { name: l("Enter Prime Fitness", "ادخل Prime Fitness"), exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: l("Your setup is complete", "اكتمل إعداد حسابك") }),
    ).toBeVisible();
    expect(backend.tables.profiles[0].training_preferences).toEqual({
      goals: ["strength"],
      experience: "novice",
      weekly_days: 3,
      equipment: ["dumbbells"],
    });
    expect(backend.tables.profiles[0].onboarding_completed).toBe(true);
    if (process.env["PW_UI_SCREENSHOTS"])
      await page.screenshot({
        path: `artifacts/onboarding-full-ready-${locale}.png`,
        fullPage: true,
      });
    await page.reload();
    await expect(
      page.getByRole("region", {
        name: l("Saved training preferences", "تفضيلات التدريب المحفوظة"),
      }),
    ).toContainText(l("Dumbbells", "دمبل"));
    await page
      .getByRole("button", { name: l("Prime Vanguard apps", "تطبيقات برايم فانجارد"), exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: l("Your Prime Vanguard apps", "تطبيقات برايم فانجارد") }),
    ).toBeFocused();
    await page
      .getByRole("button", {
        name: l("Continue to device setup", "متابعة إلى إعداد الجهاز"),
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: l("Return to ready screen", "العودة إلى شاشة الاستعداد"),
        exact: true,
      })
      .click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page
      .getByRole("link", { name: l("Go to Today", "الانتقال إلى اليوم"), exact: true })
      .click();
    await expect(page).toHaveURL(/\/today/);
  });
}

test("onboarding retains choices, reviews consent and recovers a lost save receipt", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  Object.assign(backend.tables.profiles[0], { onboarding_completed: false, display_name: "" });
  let writes = 0;
  await context.route("**/rest/v1/profiles**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    writes++;
    Object.assign(backend.tables.profiles[0], route.request().postDataJSON());
    return route.abort("failed");
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Begin setup", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Display name", { exact: true })).toBeFocused();
  await page.getByLabel("Display name", { exact: true }).fill("New Athlete");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: /Imperial/ }).check();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("New Athlete");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Imperial/ })).toBeChecked();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review & consent" })).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Enter Prime Fitness", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "I understand and agree" }).check();
  await page.getByRole("button", { name: "Enter Prime Fitness", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(writes).toBe(1);
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Enter Prime Fitness", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your setup is complete" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your setup is complete" })).toBeFocused();
  await expect(page.getByText(/No active program is assigned yet/)).toBeVisible();
  expect(writes).toBe(1);
  expect(backend.tables.profiles[0].units).toBe("imperial");
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "test-results/onboarding-complete-mobile.png", fullPage: true });
});

test("onboarding does not overwrite completed setup or misreport an unavailable program", async ({
  page,
  context,
}) => {
  await fakeBackend(context);
  let writes = 0,
    fail = true;
  await context.route("**/rest/v1/profiles**", (route) => {
    if (route.request().method() === "PATCH") writes++;
    return route.fallback();
  });
  await context.route("**/rest/v1/program_assignments**", (route) =>
    fail ? route.fulfill({ status: 503, json: { message: "Unavailable" } }) : route.fallback(),
  );
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Your setup is complete" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("setup remains saved");
  fail = false;
  await page.getByRole("button", { name: "Retry program check" }).click();
  await expect(page.getByText(/No active program is assigned yet/)).toBeVisible();
  expect(writes).toBe(0);
});

test("onboarding language radios keep keyboard focus and assigned members get a program action", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  let blockProfileRefresh = false;
  await context.route("**/rest/v1/profiles**", (route) => {
    if (route.request().method() === "PATCH") blockProfileRefresh = true;
    if (route.request().method() === "GET" && blockProfileRefresh)
      return route.fulfill({ status: 403, json: { message: "Unavailable" } });
    return route.fallback();
  });
  backend.tables.profiles[0].onboarding_completed = false;
  backend.tables.program_assignments = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      program_version_id: crypto.randomUUID(),
      active: true,
    },
  ];
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/onboarding");
  await page.getByRole("radio", { name: "English", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('input[name="welcome-language"][value="ar"]')).toBeChecked();
  await expect(page.locator("main")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "بدء الإعداد", exact: true }).click();
  await page.locator('input[name="setup-language"][value="en"]').check();
  const english = page.getByRole("radio", { name: "English", exact: true });
  await english.focus();
  await english.press("ArrowLeft");
  const arabic = page.locator('input[name="setup-language"][value="ar"]');
  await expect(arabic).toBeChecked();
  await expect(arabic).toBeFocused();
  await expect(page.locator("main")).toHaveAttribute("dir", "rtl");
  for (const option of await page.locator('input[name="setup-language"]').all()) {
    const box = await option.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "test-results/onboarding-ar-mobile.png", fullPage: true });
  await english.check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: "I understand and agree" }).check();
  await page.getByRole("button", { name: "Enter Prime Fitness", exact: true }).click();
  await expect(page.getByRole("link", { name: "View my program" })).toHaveAttribute(
    "href",
    /\/train\?section=program/,
  );
  await expect(page.getByRole("alert")).toContainText("last confirmed settings", {
    timeout: 15000,
  });
  await expect(page.getByRole("heading", { name: "Your setup is complete" })).toBeVisible();
  blockProfileRefresh = false;
  await page.getByRole("button", { name: "Retry profile refresh" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("wellness edits preserve existing fields and reject a stale tab without losing its draft", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { offline: true });
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  backend.tables.wellness_checkins = [
    {
      id: crypto.randomUUID(),
      member_id: userId,
      log_date: day,
      sleep_hours: 8,
      energy: 3,
      soreness: 2,
      notes: "Saved wellness",
      revision: 1,
    },
  ];
  await page.goto("/progress?section=body");
  await expect(page.getByLabel("Sleep hours", { exact: true })).toHaveValue("8");
  await page.getByLabel(/^Energy/).fill("4");
  await page.getByRole("button", { name: "Save check-in on device", exact: true }).click();
  await expect.poll(() => backend.tables.wellness_checkins[0].energy).toBe(4);
  expect(backend.tables.wellness_checkins[0]).toMatchObject({
    sleep_hours: 8,
    soreness: 2,
    notes: "Saved wellness",
  });
  await expect(
    page.getByRole("button", { name: "Save check-in on device", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Notes", { exact: true }).fill("Local wellness draft");
  const peer = await context.newPage();
  await peer.goto("/progress?section=body");
  await expect(peer.getByLabel("Notes", { exact: true })).toHaveValue("Saved wellness");
  await peer.getByLabel("Notes", { exact: true }).fill("Peer wellness update");
  await peer.getByRole("button", { name: "Save check-in on device", exact: true }).click();
  await expect.poll(() => backend.tables.wellness_checkins[0].notes).toBe("Peer wellness update");
  await expect(page.getByText("Peer wellness update", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save check-in on device", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("changed in another tab");
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue("Local wellness draft");
  expect(backend.tables.wellness_checkins[0].notes).toBe("Peer wellness update");
  await page.getByRole("button", { name: "Reload saved check-in", exact: true }).click();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue("Peer wellness update");
  await peer.close();
});

test("older unread notifications remain counted, pageable and eligible for mark all read", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.notifications = Array.from({ length: 21 }, (_, i) => ({
    id: crypto.randomUUID(),
    member_id: userId,
    created_at: new Date(Date.now() - i * 60000).toISOString(),
    title_en: i === 20 ? "Older unread coach notice" : "Read coach notice " + i,
    title_ar: null,
    read_at: i < 20 ? new Date().toISOString() : null,
    link: null,
  }));
  await page.goto("/today");
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark all read", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Older", exact: true }).click();
  await expect(page.getByText("Older unread coach notice", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark all read", exact: true }).click();
  await expect.poll(() => backend.tables.notifications.filter((n) => !n.read_at).length).toBe(0);
  await expect(page.getByRole("button", { name: "Mark all read", exact: true })).toHaveCount(0);
});

test("legacy workout drafts require destination review and preserve IDs through recovery", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const session = crypto.randomUUID(),
    set = crypto.randomUUID();
  await page.goto("/offline.html");
  await page.evaluate(
    async ({ owner, exercise, session, set }) => {
      const d = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("prime-fitness-workouts", 2);
        r.onupgradeneeded = () => r.result.createObjectStore("workouts");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = d.transaction("workouts", "readwrite");
        tx.objectStore("workouts").put(
          {
            version: 2,
            userId: owner,
            session: {
              id: session,
              member_id: owner,
              started_at: new Date().toISOString(),
              title: "Legacy Day",
              synced: false,
            },
            exercises: [
              {
                id: exercise,
                name_en: "Bench press",
                name_ar: null,
                muscle: "chest",
                equipment: "barbell",
              },
            ],
            sets: [
              {
                id: set,
                session_id: session,
                member_id: owner,
                exercise_id: exercise,
                set_number: 1,
                reps: 8,
                weight_kg: 40,
                rpe: 7,
                created_at: new Date().toISOString(),
                sync: "pending",
              },
            ],
            plan: [],
            superset: [],
            notes: "Legacy recovery notes",
            restEnd: 0,
            phase: "active",
            finishedAt: null,
            error: null,
          },
          owner,
        );
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      d.close();
    },
    { owner: userId, exercise: exerciseId, session, set },
  );
  await page.goto("/train");
  const recovery = page.getByRole("region", { name: "Legacy workout recovery", exact: true });
  await expect(recovery).toBeVisible();
  await expect(
    recovery.getByRole("button", { name: "Recover in this project", exact: true }),
  ).toBeDisabled();
  expect(backend.tables.workout_sessions).toHaveLength(0);
  const download = page.waitForEvent("download");
  await recovery.getByRole("button", { name: "Export legacy draft", exact: true }).click();
  const file = await download;
  const exported = JSON.parse(readFileSync((await file.path())!, "utf8"));
  expect(exported.project).toBe("unknown");
  expect(exported.workoutDraft.session.id).toBe(session);
  expect(exported.workoutDraft.sets[0].id).toBe(set);
  await recovery.getByRole("checkbox").check();
  await recovery.getByRole("button", { name: "Recover in this project", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Legacy Day", exact: true })).toBeVisible();
  await page.reload();
  await expect(recovery).toHaveCount(0);
  await expect
    .poll(() => backend.tables.set_logs.some((s) => s.id === set), { timeout: 20000 })
    .toBe(true);
  expect(backend.tables.workout_sessions.filter((s) => s.id === session)).toHaveLength(1);
});

test("sync request traffic benchmark", async ({ page, context }) => {
  const phase = process.env["PW_SYNC_TRAFFIC"];
  test.skip(phase !== "before" && phase !== "after", "Opt-in request-count benchmark");
  test.setTimeout(140000);
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { offline: true });
  let counts: Record<string, number> = {};
  let recording = false;
  context.on("request", (request) => {
    if (!recording) return;
    const operation = new URL(request.url()).pathname.match(
      /^\/rest\/v1\/(?:rpc\/)?([a-z_]+)$/,
    )?.[1];
    if (!operation) return;
    const key = `${request.method()} ${operation}`;
    counts[key] = (counts[key] ?? 0) + 1;
  });
  await page.goto("/nutrition");
  await expect(page.getByText("0 / 2500 ml", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  recording = true;
  // Real time preserves independently mounted polling phases. Split waits keep
  // each wait below one minute; this benchmark is opt-in rather than a CI delay.
  await page.waitForTimeout(32000);
  await page.waitForTimeout(32000);
  recording = false;
  const nutrition = { ...counts };
  counts = {};
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Train", exact: true })
    .click();
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await expect.poll(() => backend.tables.workout_sessions!.length).toBe(1);
  await page.waitForLoadState("networkidle");
  recording = true;
  await page.waitForTimeout(32000);
  recording = false;
  const report = {
    version: 1,
    phase,
    nutritionWindowMs: 64000,
    workoutWindowMs: 32000,
    nutrition,
    workout: { ...counts },
  };
  // Only operation names and counts: never URLs, filters, IDs, headers or bodies.
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(`artifacts/sync-traffic-${phase}.json`, JSON.stringify(report, null, 2) + "\n");
  if (phase === "after") {
    const baseline = existsSync("artifacts/sync-traffic-before.json")
      ? JSON.parse(readFileSync("artifacts/sync-traffic-before.json", "utf8"))
      : JSON.parse(readFileSync("docs/performance/sync-traffic-2026-11-02.json", "utf8")).before;
    const nutritionReads = (rows: Record<string, number>) =>
      ["food_logs", "water_logs", "nutrition_targets"].reduce(
        (total, table) => total + (rows[`GET ${table}`] ?? 0),
        0,
      );
    expect(nutritionReads(nutrition)).toBeLessThanOrEqual(nutritionReads(baseline.nutrition) / 2);
    expect(counts["GET workout_sessions"] ?? 0).toBeLessThanOrEqual(
      (baseline.workout["GET workout_sessions"] ?? 0) / 2,
    );
  }
});

test("accepted member sync refreshes writer and peer rewards without waiting for polling", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  await trainingFeatures(context, { offline: true });
  const peer = await context.newPage();
  let writerReads = 0,
    peerReads = 0,
    mutationCalls = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/member_xp_totals")) writerReads++;
  });
  peer.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/member_xp_totals")) peerReads++;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route("**/rest/v1/rpc/apply_member_mutations", async (route) => {
    mutationCalls++;
    await gate;
    await route.fallback();
  });
  await page.goto("/nutrition");
  await expect(page.getByText("0 / 2500 ml", { exact: true })).toBeVisible();
  await peer.goto("/nutrition");
  await expect(peer.getByText("0 / 2500 ml", { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.waitForLoadState("networkidle");
  await peer.waitForLoadState("networkidle");
  const writerBefore = writerReads,
    peerBefore = peerReads;
  try {
    await page.getByRole("button", { name: "+250 ml", exact: true }).click();
    await expect.poll(() => mutationCalls).toBe(1);
    expect(backend.tables.water_logs).toHaveLength(0);
    expect(writerReads).toBe(writerBefore);
    expect(peerReads).toBe(peerBefore);
  } finally {
    release();
  }
  await expect.poll(() => backend.tables.water_logs!.length).toBe(1);
  await expect.poll(() => writerReads).toBeGreaterThan(writerBefore);
  await expect.poll(() => peerReads).toBeGreaterThan(peerBefore);
  await expect(peer.getByText("250 / 2500 ml", { exact: true })).toBeVisible();
  expect(mutationCalls).toBe(1);
  await peer.close();
});

test("motion feedback follows persisted nutrition changes and respects reduced motion", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const id = crypto.randomUUID();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  backend.tables.food_logs = [
    {
      id,
      member_id: userId,
      log_date: day,
      meal: "breakfast",
      name: "Oats",
      calories: 200,
      protein_g: 10,
      carbs_g: 30,
      fat_g: 5,
      revision: 1,
    },
  ];
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const original = Element.prototype.animate;
    Object.defineProperty(window, "recordFlashes", { value: [], configurable: true });
    Element.prototype.animate = function (...args) {
      if (this.hasAttribute("data-feedback-record")) {
        (window as unknown as { recordFlashes: string[] }).recordFlashes.push(
          this.getAttribute("data-feedback-record")!,
        );
      }
      return original.apply(this, args);
    };
  });
  const flashes = () =>
    page.evaluate(() => (window as unknown as { recordFlashes: string[] }).recordFlashes);
  await page.goto("/nutrition");
  await expect(page.locator("[data-food-save-state]")).toHaveText("Synced");
  expect(await flashes()).toEqual([]);
  await page.getByRole("button", { name: "Edit Oats", exact: true }).click();
  await page.getByLabel("Calories", { exact: true }).fill("bad");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(backend.tables.food_logs![0]!.calories).toBe(200);
  expect(await flashes()).toEqual([]);
  await page.getByLabel("Calories", { exact: true }).fill("350");
  expect(await flashes()).toEqual([]);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(flashes).toContain(id);
  expect(backend.tables.food_logs![0]!.calories).toBe(350);
  const count = (await flashes()).length;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page
        .locator(`[data-feedback-record="${id}"]`)
        .evaluate((node) => node.getAnimations().length),
    )
    .toBe(0);
  await page.getByRole("button", { name: "Edit Oats", exact: true }).click();
  await page.getByLabel("Calories", { exact: true }).fill("400");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => backend.tables.food_logs![0]!.calories).toBe(400);
  expect((await flashes()).length).toBe(count);
  await page.reload();
  await expect(page.locator("[data-food-save-state]")).toHaveText("Synced");
  expect(await flashes()).toEqual([]);
});

test("crest reveal requires a new server level and never repeats on refresh", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.member_xp_totals![0]!.xp = 0;
  await page.goto("/today");
  await expect
    .poll(() => page.evaluate((id) => localStorage.getItem(`pf-level-${id}`), userId))
    .toBe("1");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  backend.tables.member_xp_totals![0]!.xp = 1000000;
  await page.reload();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-ascension]")).toBeVisible();
  await page.getByRole("button", { name: "Keep going", exact: true }).click();
  await page.reload();
  await expect
    .poll(() => page.evaluate((id) => localStorage.getItem(`pf-level-${id}`), userId))
    .toBe("100");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const locale of ["en", "ar"] as const) {
  test(`six rank auras stay distinct static and within their footprint in ${locale}`, async ({
    page,
    context,
  }) => {
    await fakeBackend(context, locale);
    await page.goto("/rewards");
    await page
      .getByRole("button", { name: locale === "ar" ? "الرحلة" : "Journey", exact: true })
      .click();
    const ranks = ["Recruit", "Seeker", "Forged", "Guardian", "Vanguard", "Prime Legend"];
    // The labeled map retains keyboard-accessible levels beside the decorative auras.
    const crests = page
      .getByLabel(locale === "ar" ? "خريطة رحلة المئة مستوى" : "100-level journey map", {
        exact: true,
      })
      .locator(".rank-crest");
    await expect(crests).toHaveCount(6);
    const blooms: number[] = [];
    for (let i = 0; i < ranks.length; i++) {
      const crest = crests.nth(i);
      await expect(crest).toHaveAttribute("data-rank", ranks[i]!);
      await expect(crest.getByRole("img")).toHaveAttribute("alt", /.+/);
      const state = await crest.evaluate((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          bloom: Number(style.getPropertyValue("--crest-bloom")),
          before: getComputedStyle(node, "::before").animationName,
          after: getComputedStyle(node, "::after").animationName,
          loaded: (node.querySelector("img") as HTMLImageElement).naturalWidth > 0,
        };
      });
      expect(state).toMatchObject({
        width: 48,
        height: 48,
        before: "none",
        after: "none",
        loaded: true,
      });
      blooms.push(state.bloom);
    }
    expect(blooms.every((bloom, i) => i === 0 || bloom > blooms[i - 1]!)).toBe(true);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await crests.evaluateAll((nodes) =>
        nodes.every((node) => node.getAnimations({ subtree: true }).length === 0),
      ),
    ).toBe(true);
    await page.emulateMedia({ forcedColors: "active" });
    expect(
      await crests.first().evaluate((node) => getComputedStyle(node, "::before").display),
    ).toBe("none");
    await page.emulateMedia({ forcedColors: "none" });
    if (locale === "en") {
      // Synthetic review board uses the actual component DOM/CSS at celebration size.
      await crests.evaluateAll((nodes) => {
        const board = document.createElement("section");
        board.id = "rank-aura-review";
        board.style.cssText =
          "display:grid;grid-template-columns:repeat(3,1fr);gap:32px;padding:40px;background:#0f172a;width:960px;color:#f1f5f9";
        for (const node of nodes) {
          const cell = document.createElement("div");
          cell.style.cssText =
            "display:grid;justify-items:center;gap:16px;padding:24px;background:#1e293b;border-radius:16px";
          const crest = node.cloneNode(true) as HTMLElement;
          crest.style.cssText = "--crest-size:160px;width:160px;height:160px";
          const img = crest.querySelector("img")!;
          img.width = 160;
          img.height = 160;
          img.sizes = "160px";
          const label = document.createElement("p");
          label.textContent = node.getAttribute("data-rank");
          cell.append(crest, label);
          board.append(cell);
        }
        document.body.prepend(board);
      });
      await page
        .locator("#rank-aura-review img")
        .evaluateAll((images) =>
          Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
        );
      await page.locator("#rank-aura-review").screenshot({ path: "artifacts/six-rank-auras.png" });
    }
  });
}

test("badges show rarity artwork and celebrate a newly earned badge once", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const badge = (code: string, title_en: string, position: number) => ({
    code,
    title_en,
    title_ar: title_en,
    description_en: `Earn ${title_en}`,
    description_ar: `Earn ${title_en}`,
    xp_bonus: 7500,
    position,
  });
  backend.tables.badges = [
    badge("first_workout", "First Rep", 1),
    badge("food_30", "Nutrition Discipline", 2),
    badge("workouts_50", "Forged in Iron", 3),
    badge("workouts_100", "Centurion", 4),
  ];
  backend.tables.member_badges = [
    { member_id: userId, badge_code: "first_workout", unlocked_at: "2026-11-01T10:00:00Z" },
  ];
  backend.tables.member_activity_credits = [{ member_id: userId, kind: "workout", credits: 12 }];
  await page.goto("/rewards");
  const earned = page.getByRole("button", { name: /First Rep/ });
  await expect(earned.locator(".badge-art")).toHaveAttribute("data-rarity", "common");
  await expect(earned.locator("img")).toHaveAttribute("src", /first_workout-256/);
  const locked = page.getByRole("button", { name: /Centurion/ });
  await expect(locked.locator(".badge-art")).toHaveAttribute("data-locked", "true");
  await expect(locked).toContainText("Legendary");
  await expect(locked).toContainText("12 / 100");
  await expect(page.getByRole("button", { name: /Nutrition Discipline/ })).toContainText("0 / 30");
  await expect(earned).not.toContainText("/");
  await locked.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Unlock to earn +7,500 XP");
  await page.keyboard.press("Escape");
  // Earning a badge after the first read celebrates it once, then never again.
  backend.tables.member_badges.push({
    member_id: userId,
    badge_code: "workouts_100",
    unlocked_at: "2026-11-24T10:00:00Z",
  });
  await page.reload();
  const unlock = page.getByRole("status").filter({ hasText: "New badge" });
  await expect(unlock).toContainText("Centurion");
  await expect(unlock).toContainText("Legendary");
  await unlock.getByRole("button", { name: "Dismiss" }).click();
  await expect(unlock).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /Centurion/ })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "New badge" })).toHaveCount(0);
});

test("celebration settings: reduced motion plays subtly and Off shows plain text", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.badges = [
    {
      code: "first_food",
      title_en: "First Fuel",
      title_ar: "أول وقود",
      description_en: "Log food",
      description_ar: "سجل الطعام",
      xp_bonus: 500,
      position: 1,
    },
    {
      code: "first_body",
      title_en: "First Check",
      title_ar: "أول قياس",
      description_en: "Body check",
      description_ar: "قياس",
      xp_bonus: 500,
      position: 2,
    },
  ];
  backend.tables.member_badges = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/today");
  // With no saved choice, a reduced-motion device gets Subtle.
  await expect(page.locator("html")).toHaveAttribute("data-celebrate", "subtle");
  backend.tables.member_badges.push({
    member_id: userId,
    badge_code: "first_food",
    unlocked_at: "2026-11-24T10:00:00Z",
  });
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "New badge" })).toContainText(
    "First Fuel",
  );
  // Off: no badge card, just a plain message, and it never repeats.
  await page.evaluate(() => localStorage.setItem("pf-celebrations", "off"));
  backend.tables.member_badges.push({
    member_id: userId,
    badge_code: "first_body",
    unlocked_at: "2026-11-24T11:00:00Z",
  });
  await page.reload();
  await expect(page.getByText("New badge: First Check")).toBeVisible();
  await expect(page.locator(".badge-unlock-card")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("New badge: First Check")).toHaveCount(0);
});

test("leaderboard always shows an opted-in member, at 0 XP and outside the top 50", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  const day = new Date(`${today}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const week_start = day.toISOString().slice(0, 10);
  backend.tables.profiles![0]!.leaderboard_opt_in = true;
  backend.tables.leaderboard_weekly = [];
  await page.goto("/rewards?section=community&community=leaderboard");
  const board = page.locator("#community-leaderboard");
  // Opted in but no XP yet this week: still listed, at 0 XP.
  await expect(board.getByRole("listitem")).toHaveText(/1\s*You\s*0 XP/);
  backend.tables.leaderboard_weekly = [
    { member_id: "behind", xp: 900, display_name: null, opted_in: true, week_start },
    { member_id: "hidden", xp: 2000, display_name: null, opted_in: false, week_start },
    ...Array.from({ length: 50 }, (_, i) => ({
      member_id: `member-${i}`,
      xp: 5000 - i,
      display_name: `Member ${i}`,
      opted_in: true,
      week_start,
    })),
    // Ten more ahead of the member; "hidden" and "behind" above must not count.
    ...Array.from({ length: 10 }, (_, i) => ({
      member_id: `ahead-${i}`,
      xp: 1300 + i,
      display_name: null,
      opted_in: true,
      week_start,
    })),
    { member_id: userId, xp: 1200, display_name: "Test Athlete", opted_in: true, week_start },
  ];
  await page.reload();
  await expect(board.getByRole("listitem")).toHaveCount(51);
  await expect(board.getByRole("listitem").last()).toHaveText(/61\s*You\s*1,200 XP/);
  // No row yet this week: 0 XP, behind everyone opted in with XP (50 + 10 + "behind").
  backend.tables.leaderboard_weekly = backend.tables.leaderboard_weekly.filter(
    (r) => r.member_id !== userId,
  );
  await page.reload();
  await expect(board.getByRole("listitem").last()).toHaveText(/62\s*You\s*0 XP/);
});

test("mission debrief shows confirmed XP, then the held level-up forges with a rolling number", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  const version = crypto.randomUUID();
  backend.tables.program_assignments = [
    { id: crypto.randomUUID(), member_id: userId, program_version_id: version, active: true },
  ];
  backend.tables.program_versions = [
    {
      id: version,
      name: "Debrief",
      version: 1,
      weeks: 1,
      items: [
        {
          id: crypto.randomUUID(),
          exercise_id: exerciseId,
          week: 1,
          day: 1,
          position: 0,
          target_sets: 1,
          target_reps: "8",
          name_en: "Bench Press",
          name_ar: "ضغط الصدر",
          muscle: "chest",
          equipment: "barbell",
          logging_mode: "weighted_reps",
          load_convention: "external_total",
        },
      ],
    },
  ];
  // An earlier session's best (40 kg × 8), so 50 kg × 8 is a new best while training.
  backend.tables.set_logs = [
    {
      id: "00000000-0000-4000-8000-0000000000b1",
      member_id: userId,
      session_id: "00000000-0000-4000-8000-0000000000b2",
      exercise_id: exerciseId,
      set_number: 1,
      weight_kg: 40,
      reps: 8,
      set_role: "working",
      logging_mode: "weighted_reps",
      side: "bilateral",
      load_convention: "external_total",
      created_at: "2026-11-20T10:00:00+00:00",
    },
  ];
  // The device has already seen level 2, so a later level is a real level-up.
  await context.addInitScript((id) => localStorage.setItem(`pf-level-${id}`, "2"), userId);
  await page.goto("/train?section=program");
  await page.getByRole("button", { name: "Start this day", exact: true }).click();
  const row = page.getByRole("group", { name: "Planned set 1", exact: true });
  await row.getByLabel("kg", { exact: true }).fill("50");
  await row.getByLabel("Reps", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Log set 1", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Completed sets" }).getByText("New best", { exact: true }),
  ).toBeVisible();
  // After the finish the server counts this week's quests and the streak.
  backend.tables.my_weekly_quests = [
    { quest: "workouts", progress: 3, goal: 3, xp: 250, awarded: true, pays: true },
    { quest: "nutrition", progress: 2, goal: 5, xp: 250, awarded: false, pays: true },
    { quest: "body", progress: 0, goal: 1, xp: 250, awarded: false, pays: true },
  ];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  backend.tables.member_activity_days = [0, 1, 2].map((i) => ({
    member_id: userId,
    activity_date: new Date(Date.parse(`${today}T12:00:00Z`) - i * 86400000)
      .toISOString()
      .slice(0, 10),
  }));
  // The server confirms this workout's XP (300 → 3,800, level 2 → 5).
  backend.tables.member_xp_totals![0]!.xp = 3800;
  // The finish awards the workout, a quest and the full week in one transaction (same time);
  // an earlier food event must not count toward this workout.
  await expect.poll(() => backend.tables.workout_sessions!.length).toBe(1);
  const session = String(backend.tables.workout_sessions![0]!.id);
  const at = "2026-11-27T10:00:00.123456+00:00";
  backend.tables.xp_events = [
    {
      id: 1,
      member_id: userId,
      amount: 20,
      source: "food",
      source_ref: "x",
      created_at: "2026-11-27T08:00:00+00:00",
    },
    {
      id: 2,
      member_id: userId,
      amount: 50,
      source: "workout",
      source_ref: session,
      created_at: at,
    },
    {
      id: 3,
      member_id: userId,
      amount: 250,
      source: "quest",
      source_ref: "2026-11-23:workouts",
      created_at: at,
    },
    {
      id: 4,
      member_id: userId,
      amount: 750,
      source: "quest_week",
      source_ref: "2026-11-23",
      created_at: at,
    },
  ];
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  const complete = page.locator("[data-workout-complete]");
  await expect(complete).toContainText("Mission complete");
  await expect(complete).toContainText("+1,050 XP");
  const breakdown = complete.getByRole("list", { name: "XP from this workout" });
  await expect(breakdown.getByRole("listitem")).toHaveText([
    /Workout\s*\+50 XP/,
    /Weekly quest\s*\+250 XP/,
    /All weekly quests\s*\+750 XP/,
  ]);
  const week = complete.getByRole("region", { name: "This week" });
  await expect(week).toContainText("3-day streak");
  await expect(week.getByRole("listitem")).toHaveText([/3 \/ 3/, /2 \/ 5/, /0 \/ 1/]);
  // The level-up waits for the debrief, then plays once.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCount(0);
  await expect(dialog).toBeVisible({ timeout: 8000 });
  await expect(dialog.locator("[data-forged]")).toBeVisible();
  await expect(dialog.locator(".level-drop .sr-only")).toHaveText("5");
  await expect(dialog.getByRole("button", { name: "Keep going" })).toBeFocused();
  await dialog.getByRole("button", { name: "Keep going" }).click();
  await expect(dialog).toHaveCount(0);
  // Sound is offered once, on the first debrief.
  const sound = complete.getByRole("region", { name: "Celebration sound" });
  await sound.getByRole("button", { name: "Turn on sound", exact: true }).click();
  await expect(sound).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("pf-celebration-sound"))).toBe("on");
});

test("rank-up plays the ascension and a new badge leaves a dot on Rewards until opened", async ({
  page,
  context,
}) => {
  const backend = await fakeBackend(context);
  backend.tables.badges = [
    {
      code: "first_workout",
      title_en: "First Rep",
      title_ar: "أول تكرار",
      description_en: "Finish a workout",
      description_ar: "أنهِ تمريناً",
      xp_bonus: 500,
      position: 1,
    },
  ];
  backend.tables.member_badges = [];
  await context.addInitScript((id) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(`pf-level-${id}`, "15");
    localStorage.setItem(`pf-level-${id}-rank`, "Recruit");
    localStorage.setItem(`pf-earned-badges-${id}`, "[]");
  }, userId);
  // Level 16 is the first Seeker level.
  backend.tables.member_xp_totals![0]!.xp = backend.tables.level_thresholds!.find(
    (row) => row.level === 16,
  )!.xp_required as number;
  backend.tables.member_badges.push({
    member_id: userId,
    badge_code: "first_workout",
    unlocked_at: "2026-11-24T10:00:00Z",
  });
  await page.goto("/today");
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("[data-ascension]")).toBeVisible();
  await expect(dialog).toContainText("Seeker");
  await dialog.getByRole("button", { name: "Keep going" }).click();
  // The badge follows the rank-up, then the Rewards tab keeps a dot.
  await expect(page.getByRole("status").filter({ hasText: "New badge" })).toContainText(
    "First Rep",
  );
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("img", { name: "New badge" })).toBeVisible();
  await nav.getByRole("link", { name: /Rewards/ }).click();
  await expect(nav.getByRole("img", { name: "New badge" })).toHaveCount(0);
});

test("leaderboard arrows show places moved since the last visit", async ({ page, context }) => {
  const backend = await fakeBackend(context);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  const day = new Date(`${today}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const week_start = day.toISOString().slice(0, 10);
  backend.tables.profiles![0]!.leaderboard_opt_in = true;
  const rival = { member_id: "rival", display_name: "Rival", opted_in: true, week_start };
  const me = { member_id: userId, display_name: "Test Athlete", opted_in: true, week_start };
  // The fake backend does not sort, so rows are listed in board order.
  backend.tables.leaderboard_weekly = [
    { ...rival, xp: 900 },
    { ...me, xp: 500 },
  ];
  await page.goto("/rewards?section=community&community=leaderboard");
  const board = page.locator("#community-leaderboard");
  await expect(board.getByRole("listitem")).toHaveCount(2);
  await expect(board.getByRole("img", { name: /since your last visit/ })).toHaveCount(0);
  backend.tables.leaderboard_weekly = [
    { ...me, xp: 1200 },
    { ...rival, xp: 900 },
  ];
  await page.reload();
  await expect(board.getByRole("listitem").first()).toContainText("You");
  await expect(board.getByRole("img", { name: "Up 1 since your last visit" })).toBeVisible();
  await expect(board.getByRole("img", { name: "Down 1 since your last visit" })).toBeVisible();
});
