import { test, expect, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
const id = "00000000-0000-4000-8000-000000000091";
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "athlete@test.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
async function backend(context: BrowserContext, signedIn = false) {
  const url = readFileSync(".env", "utf8").match(/^VITE_SUPABASE_URL=["']?([^\r\n"']+)/m)?.[1];
  if (!url) throw new Error("Public Supabase URL is required for the browser fixture.");
  const ref = new URL(url).hostname.split(".")[0];
  const payload = Buffer.from(
    JSON.stringify({
      sub: id,
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url");
  const session = {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`,
    refresh_token: "fixture-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
  const state = {
    tokenFailure: true,
    signupFailure: false,
    networkRecovery: false,
    updateFailure: false,
    delay: 0,
    tokenCalls: 0,
    recoverCalls: 0,
    resendCalls: 0,
    updateCalls: 0,
    signupCalls: 0,
    active: signedIn,
    redirectTo: "",
  };
  await context.addInitScript(
    ({ key, session, signedIn }) => {
      localStorage.setItem("pf-locale", "en");
      if (signedIn) localStorage.setItem(key, JSON.stringify(session));
    },
    { key: `sb-${ref}-auth-token`, session, signedIn },
  );
  await context.route("**/auth/v1/**", async (route) => {
    const req = route.request(),
      uri = new URL(req.url()),
      action = uri.pathname.split("/").pop();
    const fail = (code: string, message: string, status = 400) =>
      route.fulfill({
        status,
        headers: { "x-supabase-api-version": "2024-01-01" },
        json: { code, error_code: code, msg: message, message },
      });
    if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
    if (action === "token") {
      state.tokenCalls++;
      if (state.tokenFailure)
        return void (await fail("invalid_credentials", "Invalid login credentials"));
      state.active = true;
      return void (await route.fulfill({ json: session }));
    }
    if (action === "signup") {
      state.signupCalls++;
      state.redirectTo = uri.searchParams.get("redirect_to") ?? "";
      if (state.signupFailure)
        return void (await fail("unexpected_failure", "Database error saving new user", 500));
      return void (await route.fulfill({ json: { user, session: null } }));
    }
    if (action === "recover") {
      state.recoverCalls++;
      state.redirectTo = uri.searchParams.get("redirect_to") ?? "";
      if (state.networkRecovery) return void (await route.abort("connectionfailed"));
      return void (await route.fulfill({ json: {} }));
    }
    if (action === "resend") {
      state.resendCalls++;
      return void (await route.fulfill({ json: {} }));
    }
    if (action === "user") {
      if (req.method() === "PUT") {
        state.updateCalls++;
        if (state.updateFailure)
          return void (await fail("weak_password", "Password is too weak", 422));
      }
      if (!req.headers()["authorization"])
        return void (await fail("session_not_found", "No session", 401));
      return void (await route.fulfill({ json: user }));
    }
    await route.fulfill({ json: {} });
  });
  await context.route("**/rest/v1/**", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    let rows: unknown[] = [];
    if (table === "profiles")
      rows = [
        {
          ...user,
          display_name: "Test Athlete",
          access_active: true,
          onboarding_completed: true,
          locale: "en",
          units: "metric",
          avatar_url: null,
        },
      ];
    if (table === "user_roles") rows = [{ user_id: id, role: "member" }];
    const single = route.request().headers()["accept"]?.includes("vnd.pgrst.object");
    await route.fulfill({ json: single ? (rows[0] ?? null) : rows });
  });
  return { state, session };
}

test("login validates accessibly, sends legacy passwords and keeps errors visible", async ({
  page,
  context,
}) => {
  const { state } = await backend(context);
  await page.goto("/auth");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.getByLabel("Email", { exact: true }).fill("athlete@test.invalid");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("email or password is incorrect");
  expect(state.tokenCalls).toBe(1);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
});

test("Arabic forms preserve LTR email and fit a mobile viewport", async ({ page, context }) => {
  await backend(context);
  await page.goto("/auth");
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("heading", { name: "أهلاً بعودتك" })).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("البريد الإلكتروني", { exact: true })).toHaveAttribute("dir", "ltr");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/auth-ar-mobile.png", fullPage: true });
});

test("signup database failures remain service errors and confirmation has a cooldown", async ({
  page,
  context,
}) => {
  const { state } = await backend(context);
  state.signupFailure = true;
  await page.goto("/auth?mode=signup&redirect=%2Fprogress%3Fexercise%3Dbench");
  await page.getByLabel("Display name", { exact: true }).fill("Athlete");
  await page.getByLabel("Email", { exact: true }).fill("athlete@test.invalid");
  await page.getByLabel("Password", { exact: true }).fill("a-long-unique-passphrase");
  await page.getByRole("button", { name: "Activate account", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("couldn’t complete this request");
  await expect(page.getByRole("alert")).not.toContainText("invitation");
  state.signupFailure = false;
  await page.getByRole("button", { name: "Activate account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resend confirmation", exact: true }),
  ).toBeDisabled();
  expect(new URL(state.redirectTo).searchParams.get("redirect")).toBe("/progress?exercise=bench");
  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
});

test("resend and reset requests show persistent generic feedback with cooldowns", async ({
  page,
  context,
}) => {
  const { state } = await backend(context);
  await page.goto("/auth?mode=confirm");
  await page.getByLabel("Email", { exact: true }).fill("athlete@test.invalid");
  await page.getByRole("button", { name: "Resend confirmation", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "If confirmation is needed" }),
  ).toBeVisible();
  expect(state.resendCalls).toBe(1);
  await page.goto("/auth?mode=forgot");
  await page.getByLabel("Email", { exact: true }).fill("athlete@test.invalid");
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "If that email has an account" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Send reset link", exact: true })).toBeDisabled();
  expect(state.redirectTo).toBe("http://127.0.0.1:3173/reset-password");
});

test("missing and expired recovery links offer another email", async ({ page, context }) => {
  await backend(context);
  await page.goto("/reset-password");
  await expect(page.getByRole("alert")).toContainText("invalid, expired or already used");
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Request a new reset link" }).click();
  await expect(page.getByRole("button", { name: "Send reset link", exact: true })).toBeVisible();
  await page.goto(
    "/reset-password#error=access_denied&error_code=otp_expired&error_description=Expired",
  );
  await expect(page.getByRole("alert")).toContainText("invalid, expired or already used");
});

test("network failures allow retry and pending requests lock navigation", async ({
  page,
  context,
}) => {
  const { state } = await backend(context);
  state.networkRecovery = true;
  await page.goto("/auth?mode=forgot");
  await page.getByLabel("Email", { exact: true }).fill("athlete@test.invalid");
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("couldn’t connect");
  await expect(page.getByRole("button", { name: "Send reset link", exact: true })).toBeEnabled();
  state.networkRecovery = false;
  state.delay = 700;
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sending…", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Back to sign in", exact: true })).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: "If that email has an account" }),
  ).toBeVisible();
});

test("real SDK recovery event survives refresh, validates confirmation and retries", async ({
  page,
  context,
}) => {
  const { state, session } = await backend(context);
  state.updateFailure = true;
  await page.goto(
    `/reset-password#access_token=${session.access_token}&refresh_token=${session.refresh_token}&type=recovery&expires_in=3600&token_type=bearer`,
  );
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("a-new-long-passphrase");
  await page.getByLabel("Confirm new password", { exact: true }).fill("different-password");
  await page.getByRole("button", { name: "Save new password", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("don’t match");
  expect(state.updateCalls).toBe(0);
  await page.getByLabel("Confirm new password", { exact: true }).fill("a-new-long-passphrase");
  await page.getByRole("button", { name: "Save new password", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("stronger password");
  state.updateFailure = false;
  await page.getByRole("button", { name: "Save new password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Password updated", exact: true })).toBeVisible();
  expect(state.updateCalls).toBe(2);
  await page.goto("/reset-password");
  await expect(page.getByRole("alert")).toContainText("invalid, expired or already used");
});

test("successful login preserves an internal destination and blocks external ones", async ({
  page,
  context,
}) => {
  const { state } = await backend(context);
  state.tokenFailure = false;
  await page.goto("/progress?exercise=bench%20press#records");
  await page.getByLabel("Email", { exact: true }).fill("athlete@test.invalid");
  await page.getByLabel("Password", { exact: true }).fill("a-valid-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/progress" &&
      url.searchParams.get("exercise") === "bench press" &&
      url.hash === "#records",
  );
  await page.goto("/auth?redirect=%2F%2Fevil.example");
  await expect(page).toHaveURL(/\/today$/);
});

test("authentication modes retain email, clear secrets and fit a short phone screen", async ({
  page,
  context,
}) => {
  await backend(context);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("athlete@test.invalid");
  await page.getByLabel("Password", { exact: true }).fill("secret-only-on-this-mode");
  await page.getByRole("button", { name: "Forgot password?", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("athlete@test.invalid");
  await expect(page.getByRole("region", { name: "Access context" })).toContainText(
    "secure email link",
  );
  await page.getByRole("button", { name: "Back to sign in", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("athlete@test.invalid");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  expect(page.url()).not.toContain("athlete");
  for (const control of [
    page.getByLabel("Email", { exact: true }),
    page.getByLabel("Password", { exact: true }),
    page.getByRole("button", { name: "Sign in", exact: true }),
  ]) {
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  if (process.env["PW_UI_SCREENSHOTS"])
    await page.screenshot({ path: "test-results/auth-short-mobile.png", fullPage: true });
});
