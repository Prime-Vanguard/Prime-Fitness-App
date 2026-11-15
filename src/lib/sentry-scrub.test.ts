import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/tanstackstart-react";

import { scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from "./sentry-scrub";

const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJlMTIzNDU2";
const member = "123e4567-e89b-12d3-a456-426614174000";

describe("sentry scrubbing", () => {
  it("removes tokens, keys and member ids from text", () => {
    const text = scrubText(`Bearer abcdef123456 ${jwt} sb_secret_abcdefgh12345 ${member}`);
    expect(text).toBe("Bearer [token] [token] [key] [id]");
  });

  it("keeps only origin and path of URLs", () => {
    expect(
      scrubUrl(
        `https://x.supabase.co/storage/v1/object/sign/photos/${member}/a.jpg?token=${jwt}#top`,
      ),
    ).toBe("https://x.supabase.co/storage/v1/object/sign/photos/[id]/a.jpg");
    expect(scrubUrl("/Prime-Fitness-App/train?food=banana")).toBe("/Prime-Fitness-App/train");
  });

  it("drops console breadcrumbs and strips data from the rest", () => {
    expect(scrubBreadcrumb({ category: "console", message: "weight 82kg" })).toBeNull();
    const crumb = scrubBreadcrumb({
      category: "fetch",
      data: { url: `https://x.co/rest/v1/sets?user=${member}`, method: "POST", body: "secret" },
    });
    expect(crumb?.data).toEqual({ method: "POST" });
  });

  it("keeps only the member id and strips request details", () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: member, email: "a@b.co", username: "ali", ip_address: "1.2.3.4" },
      request: {
        url: `https://x.co/train?token=${jwt}`,
        method: "GET",
        headers: { Authorization: `Bearer ${jwt}` },
        cookies: { sb: "x" },
        data: { weight: 82 },
      },
      exception: { values: [{ type: "Error", value: `failed for ${member} with ${jwt}` }] },
      server_name: "host",
    } as ErrorEvent);
    expect(event?.user).toBeUndefined();
    expect(event?.request).toBeUndefined();
    expect(event?.exception?.values?.[0]?.value).toBe("Details withheld");
    expect(event?.server_name).toBeUndefined();
  });

  it("drops aborted requests", () => {
    const event = { exception: { values: [{ type: "AbortError", value: "aborted" }] } };
    expect(scrubEvent(event as ErrorEvent)).toBeNull();
  });

  it("drops health-data canaries from every extensible field and retains safe diagnostics", () => {
    const secret = "Noor medical soreness 9 private.jpg noor@example.test";
    const event = scrubEvent({
      type: undefined,
      message: secret,
      transaction: secret,
      user: { id: secret },
      tags: { area: "workout-sync", code: "retries-exhausted", private: secret },
      extra: { count: 4, note: secret },
      contexts: { health: { note: secret } },
      exception: {
        values: [
          {
            type: secret,
            value: secret,
            stacktrace: {
              frames: [
                {
                  filename: secret,
                  function: secret,
                  vars: { note: secret },
                  pre_context: [secret],
                },
              ],
            },
          },
        ],
      },
      breadcrumbs: [
        { category: "ui.click", message: secret },
        {
          category: "fetch",
          message: secret,
          data: { url: secret, method: "POST", status_code: 503 },
        },
      ],
    } as ErrorEvent);
    expect(JSON.stringify(event)).not.toContain(secret);
    expect(event?.tags).toEqual({ area: "workout-sync", code: "retries-exhausted" });
    expect(event?.extra).toEqual({ count: 4 });
    expect(event?.breadcrumbs).toEqual([
      { category: "fetch", data: { method: "POST", status_code: 503 } },
    ]);
  });
});
