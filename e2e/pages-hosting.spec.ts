import { test, expect, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";

const base = "/Prime-Fitness-App/";
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
  await page.getByRole("dialog").getByRole("button", { name: "Use", exact: true }).click();
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
      localStorage.setItem(
        key,
        JSON.stringify({
          user,
          access_token: token,
          refresh_token: "fixture",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
    },
    {
      key: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`,
      user,
      token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,
    },
  );
  await context.route("**/auth/v1/**", (route) => route.fulfill({ json: user }));
  return { id, user };
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
  await context.addInitScript(() => localStorage.setItem("pf-locale", "en"));
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
    await route.fulfill({
      headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      json: single ? (rows[0] ?? null) : rows,
    });
  });
  await page.goto(base + "nutrition");
  await expect(page.getByText("0 / 2500 ml", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+250 ml", exact: true }).click();
  await expect(page.getByText("250 / 2500 ml", { exact: true })).toBeVisible();
  await expect.poll(() => water.length).toBe(1);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("250 / 2500 ml", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await page.goto(base + "admin/members");
  await expect(
    page.getByText("You don't have access to this area.", { exact: true }),
  ).toBeVisible();
});
