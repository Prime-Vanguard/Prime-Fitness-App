# Authentication experience

Fresh-install owner creation uses the [trusted provisioning workflow](owner-provisioning.md) after migration `20261101160432_trusted_owner_provisioning.sql`. Existing owners and ordinary invitation signup remain intact. The public authentication UI does not offer owner bootstrap.

## October 31: access context and guided onboarding

- Sign-in, invitation activation, recovery and confirmation show distinct context. Switching modes retains the email on the current page and clears passwords; email is never added to navigation URLs. Mode changes move focus to the new heading, while a language-only change preserves the current control's focus.
- The shared branded shell uses a smaller mobile logo and tighter spacing. The existing invitation enforcement, generic authentication responses, password controls, cooldowns and recovery grants remain in place.
- Onboarding loads the current member profile before presenting three named stages: About you, Training preferences, and Review & consent. Labels, native radio groups, step focus, inline name validation and original consent wording support keyboard and bilingual use. Back preserves choices on the current page; unfinished choices are not advertised as refresh-durable storage.
- Finishing verifies the signed-in account and active profile, conditionally updates only an incomplete active profile, and requires a matching returned receipt. The consent instant and submitted preferences remain fixed during an uncertain response. Retry checks the saved record first, including equivalent timestamp formats, without overwriting a different completed setup. Unknown backend errors receive actionable translated feedback rather than raw database details.
- The completion view offers Today and, when an active assignment is found, the Program view. A failed assignment lookup has its own retry and never appears as “no program.” Already completed profiles receive this view without a new write. A verified save updates the member query cache immediately; a subsequent profile refresh failure preserves confirmed settings with a retry notice instead of reopening setup.

The save follows Supabase's documented [filtered update with returned rows](https://supabase.com/docs/reference/javascript/update). Database policies remain authoritative. These changes do not configure hosted Auth, send real emails, change membership/roles, or deploy database migrations. Physical-device keyboard/screen-reader checks and real email-delivery/redirect validation remain release gates.

The sign-in, invitation activation, confirmation/resend, forgot-password and password-reset pages now share Arabic/English text, a visible language switch, RTL layout, LTR email/password fields, and Prime Fitness branding. Language preference uses the existing app setting. Controls have mobile touch targets and visible keyboard focus; loading icons respect reduced motion.

## Behavior

- Errors stay visible with accessible announcements and field associations. Backend codes map to localized, actionable messages. An opaque database failure is never presented as proof of a missing invitation. Known invitation failures explain how to contact the member's coach; the database still enforces invitations.
- Email inputs are trimmed. Password-manager autocomplete and paste remain available. Sign-in accepts existing credentials without imposing the new-password length rule. Signup and reset require at least eight characters locally; stronger server requirements remain authoritative.
- Passwords support show/hide and Caps Lock warnings. Reset requires a matching confirmation. Password values are cleared when switching form modes and after successful activation/sign-in/reset.
- Busy requests disable form fields and form navigation, show action-specific progress, and release busy state after failure. Reset and confirmation requests use generic inbox messages and a 60-second UI cooldown; server rate limits remain authoritative. The cooldown is convenience, not an abuse/security control.
- Existing sessions are checked before redirecting signed-in members. Return destinations preserve internal queries/fragments, reject external/escaped destinations and avoid authentication-page loops.
- Recovery is recognized through the SDK's `PASSWORD_RECOVERY` event. A synchronous listener is attached when the browser client is created, before lazy route loading can miss the event. The reset page checks the current user with Auth before showing its form. Missing/invalid/expired links offer another email; verification connection failures offer retry.
- A member ID and 15-minute deadline maintain recovery-form continuity across refresh in the same tab. No extra token/password is stored. This flag only controls UI; it grants no server permissions. It is cleared on successful reset/sign-out, with an in-memory fallback when sessionStorage is unavailable. Refresh continuity requires browser storage.

## Email callbacks and production acceptance

Code changes do not change hosted Auth configuration or send real test emails. The connected Supabase tools do not expose the Auth redirect configuration, so its live allowlist was not inspected or modified.

For each intended local/production origin, configure and verify:

- Signup/resend returns to `/auth?redirect=...`. The allowlist must cover this callback with its query parameters (for example, an origin-scoped `/auth**` pattern). Keep allowed origins limited to environments you control.
- Password recovery returns to `/reset-password` on that origin.
- Set the production Site URL and verify confirmation/reset email delivery and templates using real invited accounts and an actual inbox. Browser fixtures cannot prove delivery, SMTP setup or allowlist configuration.

The existing browser client uses the SDK's implicit email callback flow. If the app is migrated to PKCE later, add and test its code-exchange callback rather than treating that as equivalent to this flow.

Password policy, leaked-password protection and CAPTCHA configuration are separate from this UI change and are unchanged.

## Verification

### October 31 follow-up

- 349 unit tests across 49 files, TypeScript, changed-file ESLint/Prettier and the production build passed.
- Isolated database suites passed 49 security and 42 reliability assertions. No new schema was introduced.
- Browser coverage spans 82 distinct mobile Chromium scenarios: the full run passed 81; its favorite-meal test was updated to wait for asynchronous server acceptance and passed in the four-scenario recovery rerun. That rerun also covers lost onboarding acknowledgements, completed-profile protection, program lookup failure, Arabic keyboard focus, assigned-program actions and retaining a confirmed save after a background profile failure.
- The HTTP fixtures use the real client SDK without sending real emails or changing hosted accounts. Screenshots cover 320 × 568 layouts and Arabic/RTL controls. Physical devices and actual email delivery remain separate acceptance checks.
- All three onboarding scenarios also passed against the final build after adding focus to the completion heading. Language-only changes continue to retain radio focus.

### Initial authentication implementation (historical)

`npm run typecheck`, changed-file ESLint, `npm test`, `npm run build`, and `npm run test:e2e`.

The 49 unit tests include redirect safety, error classification and recovery UI expiry/account isolation/storage fallback. Eight authentication browser scenarios run the real Supabase JavaScript SDK against mocked HTTP responses; these cover validation, password controls, RTL layout, service failures, confirmation, cooldowns, missing/expired recovery, network retries, recovery refresh/reset and safe return navigation. The existing ten member scenarios provide regression coverage for workout sync, storage, nutrition and progress.

For restricted Windows sessions, start the production server separately on port 3173 and set `PW_EXTERNAL_SERVER=1` for Playwright. Physical iOS/Android and real-email acceptance remain separate checks.
