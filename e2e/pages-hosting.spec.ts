import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const base = "/Prime-Fitness-App/";
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
