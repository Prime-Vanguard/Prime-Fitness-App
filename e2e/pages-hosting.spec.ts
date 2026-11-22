import { test, expect, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";

const base = "/Prime-Fitness-App/";
for (const locale of ["en", "ar"] as const) {
  test(`selected older history downloads retain recent data and survive offline reload in ${locale}`, async ({
    page,
    context,
  }) => {
    const { archivedSessionId } = await mockOfflineTrainingBackend(context);
    await page.goto(base + "profile?section=offline");
    await expect(
      page.getByText("Workout history saved: 1 workouts · 1 sets", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await page.evaluate((language) => localStorage.setItem("pf-locale", language), locale);
    await page.reload();
    const start = page.getByLabel(locale === "ar" ? "تاريخ بداية السجل" : "History start date", {
      exact: true,
    });
    const end = page.getByLabel(locale === "ar" ? "تاريخ نهاية السجل" : "History end date", {
      exact: true,
    });
    const download = page.getByRole("button", {
      name: locale === "ar" ? "تنزيل السجل المحدد" : "Download selected history",
      exact: true,
    });
    await start.fill("");
    await expect(download).toBeDisabled();
    await start.fill("2020-01-01");
    await end.fill("2020-01-31");
    await download.click();
    await expect(
      page.getByText(
        locale === "ar"
          ? "تم حفظ السجل المحدد على هذا الجهاز."
          : "Selected history saved on this device.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.goto(base + `train?section=history&session=${archivedSessionId}`);
    await expect(
      page.getByRole("heading", { name: "Archived frozen squat", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Downloaded workout/ })).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Archived frozen squat", exact: true }),
    ).toBeVisible();
    await page.goto(base + "train?section=history&from=2021-01-01&to=2021-01-31");
    await expect(
      page.getByText(
        locale === "ar"
          ? "لم يتم تنزيل بعض التواريخ المحددة. تعرض النتائج التمارين المحفوظة فقط."
          : "Some selected dates have not been downloaded. Results show saved workouts only.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        locale === "ar"
          ? "لا توجد تمارين منزّلة تطابق هذه الفلاتر."
          : "No downloaded workouts match these filters.",
        { exact: true },
      ),
    ).toBeVisible();
  });
}
async function mockOfflineTrainingBackend(context: BrowserContext) {
  const { id: memberId, user, session } = await signInPagesMember(context);
  const exerciseId = "00000000-0000-4000-8000-000000000081";
  const versionId = "00000000-0000-4000-8000-000000000082";
  const assignmentId = "00000000-0000-4000-8000-000000000083";
  const completedSessionId = "00000000-0000-4000-8000-000000000085";
  const completedSlotId = "00000000-0000-4000-8000-000000000086";
  const completedAt = new Date().toISOString();
  const completedSession = {
    id: completedSessionId,
    member_id: memberId,
    title: "Downloaded workout",
    started_at: completedAt,
    finished_at: completedAt,
    origin: "native",
    activity_date: new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }),
    time_precision: "timestamp",
    set_logs: [{ count: 1 }],
  };
  const completedSlot = {
    id: completedSlotId,
    member_id: memberId,
    session_id: completedSessionId,
    exercise_id: exerciseId,
    slot_key: "history-slot",
    snapshot: {
      name_en: "Historical frozen squat",
      name_ar: null,
      muscle: "quads",
      equipment: "barbell",
    },
  };
  const completedSet = {
    id: "00000000-0000-4000-8000-000000000087",
    member_id: memberId,
    session_id: completedSessionId,
    exercise_id: exerciseId,
    workout_exercise_id: completedSlotId,
    created_at: completedAt,
    set_number: 1,
    reps: 8,
    weight_kg: 50,
    rpe: null,
  };
  const archivedSessionId = "00000000-0000-4000-8000-000000000088";
  const archivedSlotId = "00000000-0000-4000-8000-000000000089";
  const archivedSession = {
    ...completedSession,
    id: archivedSessionId,
    title: "Older downloaded workout",
    activity_date: "2020-01-10",
    started_at: "2020-01-10T10:00:00Z",
    finished_at: "2020-01-10T10:30:00Z",
  };
  const archivedSlot = {
    ...completedSlot,
    id: archivedSlotId,
    session_id: archivedSessionId,
    snapshot: { ...completedSlot.snapshot, name_en: "Archived frozen squat" },
  };
  const archivedSet = {
    ...completedSet,
    id: "00000000-0000-4000-8000-000000000090",
    session_id: archivedSessionId,
    workout_exercise_id: archivedSlotId,
    created_at: "2020-01-10T10:10:00Z",
  };
  const exercise = {
    id: exerciseId,
    name_en: "Catalogue squat",
    name_ar: null,
    muscle: "quads",
    equipment: "barbell",
    active: true,
    instructions: "Keep a steady stance.",
  };
  const program = {
    id: versionId,
    name: "Offline strength",
    version: 1,
    weeks: 1,
    items: [
      {
        id: "00000000-0000-4000-8000-000000000084",
        exercise_id: exerciseId,
        week: 1,
        day: 1,
        target_sets: 3,
        target_reps: "8",
        position: 1,
        name_en: "Frozen squat",
        name_ar: null,
        muscle: "quads",
        equipment: "barbell",
      },
    ],
  };
  await context.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop();
    if (table === "get_training_features")
      return route.fulfill({ json: { offline: true, logging: true } });
    const rows =
      table === "profiles"
        ? [
            {
              ...user,
              display_name: "Offline athlete",
              access_active: true,
              onboarding_completed: true,
              leaderboard_opt_in: false,
              units: "metric",
              locale: "en",
            },
          ]
        : table === "user_roles"
          ? [{ role: "member" }]
          : table === "program_assignments"
            ? [{ id: assignmentId, program_version_id: versionId }]
            : table === "program_versions"
              ? [program]
              : table === "workout_sessions"
                ? [completedSession, archivedSession]
                : table === "workout_exercises"
                  ? [completedSlot, archivedSlot]
                  : table === "set_logs"
                    ? [completedSet, archivedSet]
                    : table === "exercises"
                      ? [exercise]
                      : [];
    const dateFilter = url.searchParams.get("or");
    const from = dateFilter?.match(/activity_date\.gte\.([0-9-]+)/)?.[1];
    const to = dateFilter?.match(/activity_date\.lte\.([0-9-]+)/)?.[1];
    const sessionFilter = url.searchParams.get("session_id");
    const filteredRows = rows.filter((row) => {
      const record = row as Record<string, unknown>;
      if (table === "workout_sessions" && url.searchParams.get("finished_at") === "is.null")
        return false;
      if (
        "activity_date" in record &&
        ((from && String(record["activity_date"]) < from) ||
          (to && String(record["activity_date"]) > to))
      )
        return false;
      if (sessionFilter?.startsWith("eq.") && record["session_id"] !== sessionFilter.slice(3))
        return false;
      if (
        sessionFilter?.startsWith("in.(") &&
        !sessionFilter.slice(4, -1).split(",").includes(String(record["session_id"]))
      )
        return false;
      return true;
    });
    const single = route.request().headers()["accept"]?.includes("vnd.pgrst.object");
    const offset = Number(url.searchParams.get("offset") ?? 0);
    await route.fulfill({ json: single ? (filteredRows[0] ?? null) : offset ? [] : filteredRows });
  });
  return { completedSessionId, archivedSessionId, user, session };
}

test("a staff member explicitly saves a summary and loses the copy when the assignment ends", async ({
  page,
  context,
}) => {
  const { user: actor } = await mockOfflineTrainingBackend(context);
  const member = {
    id: "00000000-0000-4000-8000-000000000097",
    display_name: "Assigned athlete",
    email: "assigned@test.invalid",
  };
  const assignment = { id: "00000000-0000-4000-8000-000000000098", member_id: member.id };
  let assigned = true;
  let accessChecks = 0;
  await context.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").at(-1);
    const filters = url.searchParams;
    let rows: object[];
    if (table === "profiles") {
      rows = filters.get("id")?.includes(member.id)
        ? [member]
        : [
            {
              ...actor,
              display_name: "Roster coach",
              access_active: true,
              onboarding_completed: true,
              units: "metric",
              locale: "en",
            },
          ];
    } else if (table === "user_roles") rows = [{ role: "coach" }];
    else if (table === "coach_assignments") {
      if (filters.get("member_id") === `eq.${member.id}`) accessChecks++;
      rows = assigned ? [assignment] : [];
    } else if (table === "workout_sessions" && filters.get("member_id") === `eq.${member.id}`) {
      if (request.method() === "HEAD")
        return route.fulfill({
          headers: { "content-range": "0-1/2", "access-control-expose-headers": "Content-Range" },
          body: "",
        });
      rows =
        filters.get("activity_date") === "is.null"
          ? []
          : [
              {
                id: "00000000-0000-4000-8000-000000000096",
                started_at: "2026-01-10T08:00:00Z",
                activity_date: "2026-01-10",
              },
            ];
    } else if (["member_xp_totals", "level_thresholds", "pods"].includes(table ?? "")) rows = [];
    else return route.fallback();
    const single = request.headers()["accept"]?.includes("vnd.pgrst.object");
    await route.fulfill({
      json: single ? (rows[0] ?? null) : Number(filters.get("offset")) ? [] : rows,
    });
  });
  await page.goto(base + "members");
  await expect(page.getByRole("heading", { name: "Assigned athlete", exact: true })).toBeVisible();
  expect(accessChecks).toBe(0);
  await page.getByRole("button", { name: "Save summary for offline use", exact: true }).click();
  await expect(page.getByText("Summary saved on this device.", { exact: false })).toBeVisible();
  expect(accessChecks).toBeGreaterThanOrEqual(2);
  await page.getByRole("link", { name: "View saved summaries", exact: true }).click();
  const saved = page.getByRole("region", { name: "Saved staff summaries", exact: true });
  await expect(saved.getByRole("heading", { name: "Assigned athlete", exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(saved.getByRole("heading", { name: "Assigned athlete", exact: true })).toBeVisible();
  await expect(saved.getByText(/Completed workouts: 2/)).toBeVisible();
  await expect(saved.getByText(member.email, { exact: true })).toHaveCount(0);
  const beforeReconnect = accessChecks;
  assigned = false;
  await context.setOffline(false);
  await expect.poll(() => accessChecks).toBeGreaterThan(beforeReconnect);
  await page.reload();
  await expect(
    saved.getByText("No staff summaries saved on this device.", { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("App & gym experience", { exact: true })).toBeVisible();
  await expect(saved.getByRole("heading", { name: "Assigned athlete", exact: true })).toHaveCount(
    0,
  );
});

test("an admin can draft targets offline and confirm only after reviewing fresh targets", async ({
  page,
  context,
}) => {
  const { user: actor } = await mockOfflineTrainingBackend(context);
  const member = {
    id: "00000000-0000-4000-8000-000000000099",
    display_name: "Target athlete",
    email: "target@test.invalid",
  };
  let writes = 0;
  let target = {
    member_id: member.id,
    calories: 2200,
    protein_g: 150,
    carbs_g: null,
    fat_g: null,
    water_ml: 2500,
    updated_at: "2026-11-18T10:00:00Z",
    set_by: actor.id,
  };
  await context.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const filters = url.searchParams;
    const table = url.pathname.split("/").at(-1);
    let rows: object[];
    if (table === "profiles") {
      const actorProfile = {
        ...actor,
        access_active: true,
        onboarding_completed: true,
        display_name: "Test admin",
        units: "metric",
        locale: "en",
      };
      const ids = filters.get("id");
      rows = ids
        ? [actorProfile, member].filter(({ id }) => ids.includes(id))
        : [actorProfile, member];
    } else if (table === "user_roles") {
      rows = [{ role: "admin" }];
    } else if (table === "nutrition_targets" && filters.get("member_id") === `eq.${member.id}`) {
      if (request.method() === "PATCH") {
        writes++;
        expect(filters.get("updated_at")).toBe(`eq.${target.updated_at}`);
        expect(filters.get("calories")).toBe("eq.2300");
        target = { ...target, ...request.postDataJSON() };
      }
      rows = [target];
    } else return route.fallback();
    const single = request.headers()["accept"]?.includes("vnd.pgrst.object");
    await route.fulfill({
      json: single ? (rows[0] ?? null) : Number(filters.get("offset")) ? [] : rows,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "admin/targets");
  await page.getByRole("combobox", { name: "member", exact: true }).selectOption(member.id);
  await page.getByRole("button", { name: "Download targets for offline drafting" }).click();
  await expect(page.getByText("Targets saved on this device.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open App & offline", exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(() => localStorage.setItem("pf-locale", "ar"));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const arabicDraft = page.getByRole("region", { name: "مسودات أهداف التغذية" });
  const calories = arabicDraft.getByRole("textbox", { name: "السعرات الحرارية (كيلو كالوري)" });
  await expect(calories).toHaveValue("2200");
  await calories.fill("٢٤٠٠");
  await arabicDraft.getByRole("button", { name: "حفظ مسودة الأهداف على الجهاز" }).press("Enter");
  await expect(arabicDraft.getByText("تم حفظ مسودة الأهداف على هذا الجهاز.")).toBeVisible();
  await page.evaluate(() => localStorage.setItem("pf-locale", "en"));
  await page.reload();
  const offline = page.getByRole("region", { name: "Nutrition target drafts" });
  await expect(offline.getByRole("textbox", { name: "Calories (kcal)" })).toHaveValue("2400");
  await expect(offline.getByText(member.email)).toHaveCount(0);

  target = { ...target, calories: 2300, protein_g: 160, updated_at: "2026-11-18T11:00:00Z" };
  await context.setOffline(false);
  await page.goto(base + "admin/targets");
  await page.getByRole("combobox", { name: "member", exact: true }).selectOption(member.id);
  await page.getByRole("button", { name: "Load device draft", exact: true }).click();
  await expect(page.getByText(/Some targets you edited changed online/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "kcal", exact: true })).toHaveValue("2400");
  await page.getByRole("button", { name: "Review targets", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review daily targets", exact: true });
  await expect(review.getByText(/2300.*2400/)).toBeVisible();
  expect(writes).toBe(0);
  await review.getByRole("button", { name: "Confirm changes", exact: true }).click();
  await expect(page.getByText("Daily targets saved.", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  expect(target).toMatchObject({ calories: 2400, protein_g: 160 });
  await page.getByRole("link", { name: "Open App & offline", exact: true }).click();
  await expect(offline.getByRole("textbox", { name: "Calories (kcal)" })).toHaveValue("2400");
  await expect(offline.getByText("Draft saved on device", { exact: true })).toHaveCount(0);
});

test("retains queued preferences through a rejected refresh, sign-in and resume", async ({
  page,
  context,
}) => {
  const { user, session } = await mockOfflineTrainingBackend(context);
  let displayName = "Prepared athlete";
  let uploads = 0;
  let rejectRefresh = false;
  await context.route("**/rest/v1/profiles?**", async (route) => {
    if (route.request().method() === "PATCH") {
      uploads++;
      displayName = route.request().postDataJSON().display_name;
    }
    const profile = {
      ...user,
      display_name: displayName,
      access_active: true,
      onboarding_completed: true,
      units: "metric",
      locale: "en",
      leaderboard_opt_in: false,
      updated_at: "2026-01-01T00:00:00Z",
    };
    const single = route.request().headers()["accept"]?.includes("vnd.pgrst.object");
    await route.fulfill({ json: single ? profile : [profile] });
  });
  await context.route("**/auth/v1/token?**", (route) => {
    const grant = new URL(route.request().url()).searchParams.get("grant_type");
    if (grant === "password") return route.fulfill({ json: session });
    if (!rejectRefresh) return route.abort("internetdisconnected");
    return route.fulfill({
      status: 400,
      json: {
        code: "refresh_token_not_found",
        error_code: "refresh_token_not_found",
        msg: "Refresh expired",
      },
    });
  });
  await page.goto(base + "profile?section=preferences");
  const name = page.getByLabel("Display name", { exact: true });
  await expect(name).toHaveValue("Prepared athlete");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await name.fill("Kept on this device");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const pending = page.getByText("Saved on this device. Waiting to sync.", { exact: true });
  await expect(pending).toBeVisible();
  await page.evaluate(() => localStorage.setItem("pf-test-expired", "yes"));
  await page.reload();
  await expect(name).toHaveValue("Kept on this device");
  await page.evaluate(() => localStorage.setItem("pf-test-skip-session", "yes"));
  rejectRefresh = true;
  await context.setOffline(false);
  const recovery = page.getByText(
    "Sign in again with the same account to resume work saved on this device.",
  );
  await expect(recovery).toBeVisible();
  expect(uploads).toBe(0);
  await expect(name).toHaveCount(0);
  await page.reload();
  await expect(recovery).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/profile\?section=preferences$/);
  await expect(name).toHaveValue("Kept on this device");
  await expect.poll(() => uploads).toBe(1);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  await expect(recovery).toHaveCount(0);
});
test("downloads older personal records and opens them after an offline restart", async ({
  page,
  context,
}) => {
  const { user } = await mockOfflineTrainingBackend(context);
  const day = "2020-01-10";
  const record = { id: "00000000-0000-4000-8000-000000000099", member_id: user.id, log_date: day };
  const records: Record<string, object> = {
    food_logs: {
      ...record,
      name: "Archived breakfast",
      meal: "breakfast",
      calories: 300,
      protein_g: 20,
      carbs_g: 35,
      fat_g: 9,
    },
    water_logs: { ...record, ml: 475 },
    body_measurements: {
      id: record.id,
      member_id: user.id,
      measured_on: day,
      weight_kg: 64.2,
      waist_cm: null,
      body_fat_pct: null,
    },
    wellness_checkins: { ...record, notes: "Archived check-in", energy: 4 },
  };
  await context.route(
    /\/rest\/v1\/(food_logs|water_logs|body_measurements|wellness_checkins|nutrition_targets)\?/,
    async (route) => {
      const url = new URL(route.request().url());
      const table = url.pathname.split("/").at(-1)!;
      if (table === "nutrition_targets")
        return route.fulfill({ json: { member_id: user.id, water_ml: 2500 } });
      expect(url.searchParams.get("member_id")).toBe(`eq.${user.id}`);
      const dates = url.searchParams.getAll(
        table === "body_measurements" ? "measured_on" : "log_date",
      );
      const containsDay = dates.every((filter) =>
        filter.startsWith("gte.") ? day >= filter.slice(4) : day <= filter.slice(4),
      );
      return route.fulfill({
        json: containsDay && !Number(url.searchParams.get("offset")) ? [records[table]] : [],
      });
    },
  );
  await page.goto(base + "profile?section=offline");
  await expect(page.getByText("Downloaded records: 0", { exact: true })).toBeVisible();
  await page.getByLabel("Personal records start date", { exact: true }).fill("2020-01-01");
  await page.getByLabel("Personal records end date", { exact: true }).fill("2020-01-31");
  await page
    .getByRole("button", { name: "Download selected personal records", exact: true })
    .click();
  await expect(
    page.getByText("Selected personal records saved on this device.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Downloaded personal record date ranges/)).toContainText(
    "2020-01-01",
  );
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto(base + `nutrition?day=${day}`);
  await expect(page.getByText("475 / 2500 ml", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("475 / 2500 ml", { exact: true })).toBeVisible();
  await expect(page.getByText("Archived breakfast", { exact: true })).toBeVisible();
  await page.goto(base + "nutrition?day=2020-01-15");
  await expect(page.getByText("0 / 2500 ml", { exact: true })).toBeVisible();
  await page.goto(base + "nutrition?day=2021-01-10");
  await expect(page.getByText(/Complete totals are unavailable/)).toBeVisible();
  await page.goto(base + "progress?section=body");
  await expect(page.getByText(/64\.2/).first()).toBeVisible();
  await expect(page.getByText("Archived check-in", { exact: true })).toBeVisible();
  await page.goto(base + `nutrition?day=${day}`);
  await page.getByRole("button", { name: "+250 ml", exact: true }).click();
  await expect(page.getByText("725 / 2500 ml", { exact: true })).toBeVisible();
  await page.goto(base + "profile?section=offline");
  const storage = page.getByRole("region", { name: "Offline storage", exact: true });
  await expect(storage.getByText("Removable history (estimate)", { exact: true })).toBeVisible();
  await storage.getByRole("button", { name: "Remove downloaded history", exact: true }).click();
  await page.getByRole("button", { name: "Confirm changes", exact: true }).click();
  await expect(storage.getByText(/Automatic history downloads are paused/)).toBeVisible();
  await page.reload();
  await expect(storage.getByText(/Automatic history downloads are paused/)).toBeVisible();
  await page.goto(base + `nutrition?day=${day}`);
  await expect(page.getByText("250 / 2500 ml", { exact: true })).toBeVisible();
  await expect(page.getByText("Archived breakfast", { exact: true })).toHaveCount(0);
});

test("waits for open tabs before an app update and retains queued work after activation", async ({
  context,
  page,
  baseURL,
}) => {
  let revision = "previous";
  // Serve two versions of the production build from an isolated origin so the
  // browser exercises the real waiting and activation lifecycle.
  const server = createServer(async (incoming, response) => {
    try {
      if (!incoming.url?.startsWith(base)) {
        response.writeHead(404, { "content-type": "text/html" }).end("<p>Update status</p>");
        return;
      }
      const upstream = await fetch(new URL(incoming.url, baseURL), { redirect: "manual" });
      const headers: Record<string, string> = { "cache-control": "no-store" };
      for (const name of ["content-type", "location"]) {
        const value = upstream.headers.get(name);
        if (value) headers[name] = value;
      }
      const body = Buffer.from(await upstream.arrayBuffer());
      if (incoming.url === base + "sw.js" && revision === "next") {
        response
          .writeHead(upstream.status, headers)
          .end(
            body
              .toString()
              .replace(
                /const CACHE = PREFIX \+ "([a-f0-9]+)";/,
                'const CACHE = PREFIX + "$1-next";',
              ),
          );
      } else if (headers["content-type"]?.includes("text/html")) {
        response
          .writeHead(upstream.status, headers)
          .end(
            body
              .toString()
              .replace("</head>", `<meta name="pf-preview-build" content="${revision}"></head>`),
          );
      } else response.writeHead(upstream.status, headers).end(body);
    } catch {
      response.writeHead(500).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Preview address missing");
    const origin = `http://127.0.0.1:${address.port}`;
    const profile = origin + base + "profile?section=preferences";
    const { user } = await mockOfflineTrainingBackend(context);
    await context.route("**/rest/v1/profiles?**", (route) => {
      const columns = new URL(route.request().url()).searchParams.get("select");
      if (columns === "id,access_active")
        return route.fulfill({ json: [{ id: user.id, access_active: false }] });
      return route.fallback();
    });
    await page.goto(profile);
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Offline athlete");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const secondTab = await context.newPage();
    await secondTab.goto(profile);
    await context.setOffline(true);
    await page.getByLabel("Display name", { exact: true }).fill("Kept through update");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Saved on this device. Waiting to sync.", { exact: true }),
    ).toBeVisible();
    await context.setOffline(false);
    revision = "next";
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect(page.getByText("App update ready.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('meta[name="pf-preview-build"]')).toHaveAttribute(
      "content",
      "previous",
    );
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
      "Kept through update",
    );
    await expect(secondTab.getByText("App update ready.", { exact: true })).toBeVisible();
    await page.close();
    await secondTab.close();

    const reopened = await context.newPage();
    await reopened.goto(origin + "/update-status");
    await expect
      .poll(() =>
        reopened.evaluate(async (scope) => {
          const registration = await navigator.serviceWorker.getRegistration(scope);
          return (
            !!registration?.active &&
            !registration.waiting &&
            !registration.installing &&
            (await caches.keys()).some((key) => key.endsWith("-next"))
          );
        }, base),
      )
      .toBe(true);
    await reopened.goto(profile);
    await expect(reopened.locator('meta[name="pf-preview-build"]')).toHaveAttribute(
      "content",
      "next",
    );
    await expect(reopened.getByLabel("Display name", { exact: true })).toHaveValue(
      "Kept through update",
    );
    await expect(
      reopened.getByText("Saved on this device. Waiting to sync.", { exact: true }),
    ).toBeVisible();
    await expect(reopened.getByText("App update ready.", { exact: true })).toHaveCount(0);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

for (const expectation of [
  "sync on reconnect",
  "preserve a conflicting server edit",
  "wait for active access",
]) {
  test(`offline profile edits survive reload and ${expectation}`, async ({ page, context }) => {
    const { user } = await mockOfflineTrainingBackend(context);
    let profile = {
      ...user,
      display_name: "Original athlete",
      access_active: true,
      onboarding_completed: true,
      locale: "en",
      units: "metric",
      leaderboard_opt_in: false,
      updated_at: "2026-01-01T00:00:00Z",
    };
    const conflict = expectation === "preserve a conflicting server edit";
    let paused = expectation === "wait for active access";
    let pausedChecks = 0;
    const writes: unknown[] = [];
    await context.route("**/rest/v1/profiles?**", async (route) => {
      const filters = new URL(route.request().url()).searchParams;
      // Leave the shell's displayed profile active to test the independent upload gate.
      if (paused && filters.get("select") === "id,access_active") {
        pausedChecks++;
        return route.fulfill({ json: [{ id: user.id, access_active: false }] });
      }
      if (route.request().method() === "PATCH") {
        if (
          filters.get("id") !== `eq.${user.id}` ||
          filters.get("access_active") !== "eq.true" ||
          filters.get("updated_at") !== `eq.${profile.updated_at}`
        ) {
          return route.fulfill({ json: null });
        }
        const patch = route.request().postDataJSON();
        writes.push(patch);
        profile = { ...profile, ...patch };
      }
      const single = route.request().headers()["accept"]?.includes("vnd.pgrst.object");
      await route.fulfill({ json: single ? profile : [profile] });
    });
    await page.goto(base + "profile?section=preferences");
    const displayName = page.getByLabel("Display name", { exact: true });
    await expect(displayName).toHaveValue("Original athlete");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await displayName.fill("Device athlete");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const pending = page.getByText("Saved on this device. Waiting to sync.", { exact: true });
    await expect(pending).toBeVisible();
    await page.reload();
    await expect(displayName).toHaveValue("Device athlete");
    await expect(pending).toBeVisible();
    await page.goto(base + "profile?section=offline");
    const sync = page.getByRole("region", { name: "Member sync", exact: true });
    const preferences = sync.getByRole("listitem").filter({ hasText: "Preferences" });
    await expect(preferences).toContainText("Waiting to sync");
    await sync.getByRole("button", { name: "Retry sync", exact: true }).click();
    await expect(sync.getByRole("alert")).toHaveText("Reconnect to retry sync.");
    await preferences.getByRole("link", { name: "Preferences", exact: true }).click();
    await expect(displayName).toHaveValue("Device athlete");
    expect(writes).toEqual([]);
    if (conflict) {
      profile = { ...profile, display_name: "Other device", updated_at: "2026-01-02T00:00:00Z" };
    }
    await context.setOffline(false);
    await expect(page.getByText("Reconnect to retry sync.", { exact: true })).toHaveCount(0);
    if (paused) {
      await expect.poll(() => pausedChecks).toBeGreaterThan(0);
      await expect(pending).toBeVisible();
      expect(writes).toEqual([]);
      const hasAccessDelay = () =>
        Object.keys(localStorage).some(
          (key) => key.startsWith("pf-sync-retry:") && key.endsWith(":access"),
        );
      await expect.poll(() => page.evaluate(hasAccessDelay)).toBe(true);
      const blockedAttempts = pausedChecks;
      const secondTab = await context.newPage();
      try {
        await secondTab.goto(base + "profile?section=offline");
        await expect(
          secondTab.getByRole("listitem").filter({ hasText: "Preferences" }),
        ).toContainText("Waiting to sync");
        expect(await secondTab.evaluate(hasAccessDelay)).toBe(true);
        expect(pausedChecks).toBe(blockedAttempts);
      } finally {
        await secondTab.close();
      }
      await page.getByRole("button", { name: "App", exact: true }).click();
      await expect(preferences).toContainText("Waiting to sync");
      paused = false;
      await sync.getByRole("button", { name: "Retry sync", exact: true }).click();
      await expect(preferences).toContainText("Nothing waiting");
      await preferences.getByRole("link", { name: "Preferences", exact: true }).click();
    }
    if (conflict) {
      await expect(
        page.getByRole("alert").filter({ hasText: "changed on another device" }),
      ).toBeVisible();
      expect(writes).toEqual([]);
      await expect(displayName).toHaveValue("Device athlete");
      await page.getByRole("button", { name: "Discard pending edits", exact: true }).click();
      await expect(displayName).toHaveValue("Other device");
    } else {
      await expect(pending).toHaveCount(0);
      expect(writes).toEqual([{ display_name: "Device athlete" }]);
      await expect(displayName).toHaveValue("Device athlete");
    }
  });
}

test("automatic preparation downloads a frozen program and starts its workout after an offline restart", async ({
  page,
  context,
}) => {
  const { completedSessionId } = await mockOfflineTrainingBackend(context);
  await page.goto(base + "profile?section=offline");
  await expect(
    page.getByText("Training downloaded: 1 exercises · Offline strength", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText("Workout history saved: 1 workouts \u00b7 1 sets", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto(base + `train?section=history&session=${completedSessionId}`);
  await expect(
    page.getByRole("heading", { name: "Historical frozen squat", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Showing downloaded workout history/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Historical frozen squat", exact: true }),
  ).toBeVisible();
  await page.goto(base + "train?section=program");
  await expect(page.getByRole("heading", { name: "Offline strength", exact: true })).toBeVisible();
  await expect(page.getByText("Frozen squat", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start this day", exact: true }).click();
  await expect(page.getByRole("button", { name: "Finish workout", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Finish workout", exact: true })).toBeVisible();
});
for (const locale of ["en", "ar"] as const) {
  test(`downloaded history can be repeated offline without changing the completed record in ${locale}`, async ({
    page,
    context,
  }) => {
    const { completedSessionId } = await mockOfflineTrainingBackend(context);
    await page.goto(base + "profile?section=offline");
    await expect(
      page.getByText("Workout history saved: 1 workouts \u00b7 1 sets", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.evaluate((language) => localStorage.setItem("pf-locale", language), locale);
    await context.setOffline(true);
    await page.goto(base + `train?section=history&session=${completedSessionId}`);
    await expect(
      page.getByRole("heading", { name: "Historical frozen squat", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: locale === "ar" ? "تكرار الجلسة" : "Repeat workout",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: locale === "ar" ? "إنهاء التمرين" : "Finish workout",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: locale === "ar" ? "إنهاء التمرين" : "Finish workout",
        exact: true,
      }),
    ).toBeVisible();
  });
}

test("standalone Pages adds an exercise offline and exposes scanner lookup without camera access", async ({
  page,
  context,
}) => {
  const { user } = await signInPagesMember(context);
  const exercise = "00000000-0000-4000-8000-000000000072";
  await context.addInitScript(() => {
    const match = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = match(query);
      if (query === "(display-mode: standalone)")
        Object.defineProperty(result, "matches", { value: true });
      return result;
    };
  });
  await context.route("**/rest/v1/**", async (route) => {
    const request = route.request(),
      table = new URL(request.url()).pathname.split("/").pop();
    if (table === "get_training_features")
      return route.fulfill({ json: { food_scanning: true, guidance: true } });
    const rows =
      table === "profiles"
        ? [
            {
              ...user,
              display_name: "PWA tester",
              access_active: true,
              onboarding_completed: true,
              locale: "en",
              units: "metric",
            },
          ]
        : table === "user_roles"
          ? [{ role: "admin" }, { role: "coach" }, { role: "pod_leader" }, { role: "member" }]
          : table === "exercises" && !Number(new URL(request.url()).searchParams.get("offset"))
            ? [
                {
                  id: exercise,
                  name_en: "Bench Press",
                  name_ar: null,
                  muscle: "chest",
                  equipment: "barbell",
                  active: true,
                  logging_mode: "weighted_reps",
                  load_convention: "external_total",
                },
              ]
            : [];
    await route.fulfill({
      headers: { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` },
      json: request.headers()["accept"]?.includes("vnd.pgrst.object") ? (rows[0] ?? null) : rows,
    });
  });
  await page.goto(base + "train");
  expect(await page.evaluate(() => matchMedia("(display-mode: standalone)").matches)).toBe(true);
  await page.getByRole("button", { name: "Start workout", exact: true }).click();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Insert selected exercises", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(`[data-exercise-id="${exercise}"]`)).toHaveCount(1);
  await page.reload();
  await expect(page.locator(`[data-exercise-id="${exercise}"]`)).toHaveCount(1);
  await page.goto(base + "nutrition");
  await page.getByRole("button", { name: "Add food", exact: true }).first().click();
  await page.getByRole("button", { name: "Scan barcode or nutrition label", exact: true }).click();
  await page.getByLabel("Barcode number", { exact: true }).fill("3017620422003");
  await page.getByRole("button", { name: "Look up product", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Barcode lookup needs a connection",
  );
  await context.setOffline(false);
  await context.route("**/functions/v1/food-barcode", (route) =>
    route.fulfill({
      json: {
        status: 1,
        product: {
          product_name: "Barcode fixture",
          nutriments: {
            "energy-kcal_100g": 120,
            proteins_100g: 4,
            carbohydrates_100g: 15,
            fat_100g: 2,
          },
        },
      },
    }),
  );
  // No camera permission is needed to enter the code; no nutrition record is saved.
  await page.getByRole("button", { name: "Look up product", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Food name", { exact: true }).last(),
  ).toHaveValue("Barcode fixture");
  await expect(
    page.getByRole("button", { name: "Use reviewed values in food editor", exact: true }),
  ).toBeDisabled();
});
test("Strong file advances through every import step under the Pages prefix", async ({
  page,
  context,
}) => {
  const { id, user } = await signInPagesMember(context);
  if (!process.env["PW_PAGES_BASE_URL"])
    await context.addInitScript(() => {
      const BrowserWorker = window.Worker;
      let rejectFirst = true;
      window.Worker = class extends BrowserWorker {
        constructor(url: string | URL, options?: WorkerOptions) {
          if (rejectFirst && String(url).includes("training-import.worker")) {
            rejectFirst = false;
            throw new Error("Simulated worker startup failure");
          }
          super(url, options);
        }
      };
    });
  let submitted = 0;
  await context.route("**/rest/v1/**", async (route) => {
    const request = route.request(),
      table = new URL(request.url()).pathname.split("/").pop();
    if (table === "get_training_features") return route.fulfill({ json: { imports: true } });
    if (table === "commit_training_import") {
      submitted++;
      expect(request.postDataJSON()._provider).toBe("strong");
      return route.fulfill({ json: { accepted: 1, skipped: 0 } });
    }
    if (table === "get_import_batch_outcome")
      return route.fulfill({ json: { accepted: 1, skipped: 0, chunks: 1 } });
    const rows =
      table === "profiles"
        ? [
            {
              ...user,
              display_name: "Import tester",
              access_active: true,
              onboarding_completed: true,
              locale: "en",
              units: "metric",
            },
          ]
        : table === "user_roles"
          ? [{ role: "member" }]
          : table === "exercises" && !Number(new URL(request.url()).searchParams.get("offset"))
            ? [
                {
                  id: "00000000-0000-4000-8000-000000000072",
                  name_en: "Barbell Bench Press",
                  name_ar: null,
                  muscle: "chest",
                  equipment: "barbell",
                  active: true,
                  logging_mode: "weighted_reps",
                  load_convention: "external_total",
                },
              ]
            : [];
    return route.fulfill({
      headers: { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` },
      json: request.headers()["accept"]?.includes("vnd.pgrst.object") ? (rows[0] ?? null) : rows,
    });
  });
  await page.goto(base + "profile?section=privacy");
  if (!process.env["PW_PAGES_BASE_URL"]) {
    await page
      .getByLabel("Workout CSV file", { exact: true })
      .setInputFiles("e2e/fixtures/strong-workout.csv");
    const failure = page.getByRole("alert").filter({ hasText: "Simulated worker startup failure" });
    await expect(failure).toBeVisible();
    await expect(failure).toBeFocused();
    await expect(page.getByLabel("Workout CSV file", { exact: true })).toBeEnabled();
    expect(submitted).toBe(0);
  }
  await page
    .getByLabel("Workout CSV file", { exact: true })
    .setInputFiles("e2e/fixtures/strong-workout.csv");
  await expect(page.getByRole("button", { name: "2. Mapping", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
  if (!process.env["PW_PAGES_BASE_URL"]) {
    await expect(page.getByRole("button", { name: "2. Mapping", exact: true })).toBeFocused();
    await expect(page.getByText("File read successfully.", { exact: false })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Review import", exact: true })).toBeDisabled();
  if (!process.env["PW_PAGES_BASE_URL"])
    await expect(
      page.getByText("Review import unlocks when all names are resolved.", { exact: false }),
    ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Bench Press", exact: true })
    .selectOption("00000000-0000-4000-8000-000000000072");
  await page.getByRole("button", { name: "Review import", exact: true }).click();
  await expect(page.getByRole("button", { name: "3. Review", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page
    .getByRole("checkbox", {
      name: "I reviewed mapping and existing history for overlapping workouts. Similar workouts are not automatically merged.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Continue to import", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm import / retry", exact: true }),
  ).toBeEnabled();
  expect(submitted).toBe(0);
  await page.getByRole("button", { name: "Confirm import / retry", exact: true }).click();
  await expect(page.getByRole("button", { name: "5. Receipt", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.getByText("1 accepted workouts", { exact: true })).toBeVisible();
  expect(submitted).toBe(1);
});
async function signInPagesMember(context: BrowserContext) {
  const id = "00000000-0000-4000-8000-000000000071";
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "member@test.invalid",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const url = readFileSync(".env", "utf8").match(/^VITE_SUPABASE_URL=["']?([^\r\n"']+)/m)?.[1];
  if (!url) throw new Error("Public test project configuration missing");
  const payload = Buffer.from(
    JSON.stringify({
      sub: id,
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  await context.addInitScript(
    ({ key, user, token }) => {
      if (localStorage.getItem("pf-test-skip-session") === "yes") return;
      localStorage.setItem(
        key,
        JSON.stringify({
          user,
          access_token: token,
          refresh_token: "fixture",
          token_type: "bearer",
          expires_in: 3600,
          expires_at:
            localStorage.getItem("pf-test-expired") === "yes"
              ? 1
              : Math.floor(Date.now() / 1000) + 3600,
        }),
      );
    },
    {
      key: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`,
      user,
      token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,
    },
  );
  await context.route("**/auth/v1/**", (route) => {
    // A refresh is a session response, not a user response. Simulate unavailable
    // Auth during expiry; returning a user here fabricates an invalid refresh.
    if (new URL(route.request().url()).pathname.endsWith("/token"))
      return route.abort("internetdisconnected");
    return route.fulfill({ json: user });
  });
  return {
    id,
    user,
    session: {
      user,
      access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,
      refresh_token: "fixture",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
  };
}

test("optional scanner runtime is served under the project path without core precaching", async ({
  request,
}) => {
  const worker = await request.get(base + "scanner-runtime/worker.min.js");
  expect(worker.ok()).toBe(true);
  expect(worker.headers()["content-type"]).toContain("javascript");
  const core = await request.get(base + "scanner-runtime/core/tesseract-core-lstm.wasm");
  expect(core.ok()).toBe(true);
  expect(core.headers()["content-type"]).toBe("application/wasm");
  const license = await request.get(base + "scanner-runtime/LICENSE-core.txt");
  expect(license.ok()).toBe(true);
  expect(await license.text()).toContain("Apache License");
  const sw = await request.get(base + "sw.js");
  expect(await sw.text()).not.toContain("scanner-runtime/core");
});
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    if (!localStorage.getItem("pf-locale")) localStorage.setItem("pf-locale", "en");
  });
});
test("project URLs load assets, refresh auth and preserve a dynamic member destination", async ({
  page,
}) => {
  const failedAssets: string[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.includes("/assets/") && !response.ok())
      failedAssets.push(response.url());
  });
  await page.goto(base);
  await expect(page.getByRole("heading", { name: "Prime Fitness", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Member sign in" }).click();
  await expect(page).toHaveURL(new RegExp(base + "auth"));
  await page.reload();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.goto(base + "members/00000000-0000-4000-8000-000000000001?tab=history");
  await expect(page).toHaveURL(new RegExp(base + "auth"));
  expect(new URL(page.url()).searchParams.get("redirect")).toBe(
    "/members/00000000-0000-4000-8000-000000000001?tab=history",
  );
  expect(failedAssets).toEqual([]);
});

test("recovery emails use the hosted prefix and PWA caches stay scoped", async ({
  page,
  context,
}) => {
  let redirect = "";
  await context.route("**/auth/v1/recover**", async (route) => {
    redirect = new URL(route.request().url()).searchParams.get("redirect_to") ?? "";
    await route.fulfill({ json: {} });
  });
  await page.goto(base + "auth");
  await page.getByRole("button", { name: "Forgot password?", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("athlete@test.invalid");
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect.poll(() => redirect).toBe("http://127.0.0.1:3174" + base + "reset-password");
  const manifest = await page.request.get(base + "manifest.webmanifest");
  expect(await manifest.json()).toMatchObject({ scope: base, start_url: base + "train" });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((key) => key.startsWith("pf-shell-"));
    const urls = (
      await Promise.all(
        names.map(async (name) =>
          (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname),
        ),
      )
    ).flat();
    return urls;
  });
  expect(cached.length).toBeGreaterThan(10);
  expect(cached.every((path) => path.startsWith(base))).toBe(true);
  expect(cached.some((path) => /auth\/v1|rest\/v1/.test(path))).toBe(false);
  await context.setOffline(true);
  await page.goto(base + "train");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
});

test("a signed-in member logs water, refreshes offline and keeps admin routes protected", async ({
  page,
  context,
}) => {
  const { id, user } = await signInPagesMember(context);
  const water: Record<string, unknown>[] = [];
  await context.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const table = new URL(request.url()).pathname.split("/").pop();
    if (table === "get_training_features")
      return void (await route.fulfill({ json: { offline: true } }));
    if (table === "apply_member_mutations") {
      const mutations = request.postDataJSON()._mutations as Record<string, unknown>[];
      const rows = mutations.map((m) => {
        const row = {
          ...(m.payload as object),
          id: m.record_id,
          member_id: id,
          revision: Number(m.base_revision) + 1,
          created_at: new Date().toISOString(),
        };
        if (m.entity === "water_logs" && !water.some((old) => old.id === row.id)) water.push(row);
        return { id: m.id, status: "applied", record: row, revision: row.revision };
      });
      return void (await route.fulfill({ json: rows }));
    }
    const rows =
      table === "profiles"
        ? [
            {
              ...user,
              display_name: "Test member",
              access_active: true,
              onboarding_completed: true,
              locale: "en",
              units: "metric",
              leaderboard_opt_in: false,
            },
          ]
        : table === "user_roles"
          ? [{ role: "member" }]
          : table === "water_logs"
            ? water
            : table === "nutrition_targets"
              ? [{ member_id: id, water_ml: 2500 }]
              : [];
    const single = request.headers()["accept"]?.includes("vnd.pgrst.object");
    const offset = Number(new URL(request.url()).searchParams.get("offset") ?? 0);
    await route.fulfill({
      headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      json: single ? (rows[0] ?? null) : offset > 0 ? [] : rows,
    });
  });
  await page.goto(base + "nutrition");
  await expect(page.getByText("0 / 2500 ml", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+250 ml", exact: true }).click();
  await expect(page.getByText("250 / 2500 ml", { exact: true })).toBeVisible();
  await expect.poll(() => water.length).toBe(1);
  await page.goto(base + "profile?section=offline");
  await page.getByRole("button", { name: "Download for offline use", exact: true }).click();
  await expect(page.getByText("Downloaded records: 1", { exact: true })).toBeVisible();
  await page.goto(base + "nutrition");
  // Exercise cold restoration after expiry, not just a still-valid SDK session.
  await page.evaluate(() => localStorage.setItem("pf-test-expired", "yes"));
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("250 / 2500 ml", { exact: true })).toBeVisible();
  await page.goto(base + "profile?section=offline");
  await expect(page.getByText("App & gym experience", { exact: true })).toBeVisible();
  await expect(page.getByText("Downloaded records: 1", { exact: true })).toBeVisible();
  // Restore the online fixture before checking fresh server-authorized access.
  await page.evaluate(() => localStorage.removeItem("pf-test-expired"));
  await context.setOffline(false);
  await page.goto(base + "admin/members");
  await expect(
    page.getByText("You don't have access to this area.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    for (const storageKey of Object.keys(localStorage)) {
      if (storageKey.startsWith("pf-offline-identity:")) localStorage.removeItem(storageKey);
    }
  });
  await context.addInitScript(() => {
    const saveStorageValue = Storage.prototype.setItem;
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey.startsWith("pf-offline-identity:"))
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      return saveStorageValue.call(this, storageKey, value);
    };
  });
  await page.goto(base + "profile?section=offline");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Your account details could not be prepared for offline use." }),
  ).toBeVisible();
  await expect(page.getByText("App & gym experience", { exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("pf-locale", "ar"));
  await page.reload();
  await expect(page.getByRole("region", { name: "التجهيز دون اتصال", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "تنزيل للاستخدام دون اتصال", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
