# Analytics, CSV and numeric integrity fixes

Implemented on 26 October 2026. This batch resolves R6, R8 and R9 from the [application review](reviews/2026-10-26-application-review.md).

## Numeric integrity (R6)

Body entries now reject non-finite values, non-positive weight/waist measurements and body-fat percentages outside 0–100. Errors remain visible and invalid fields are not silently discarded. Optional fields remain nullable; zero body fat remains valid. Metric and imperial input still stores canonical kg/cm, with validation after conversion too.

Nutrition targets reject negative, fractional or oversized integer inputs instead of silently clamping/rounding them. A failed target fetch prevents saving an empty replacement. Arabic and Persian numerals and Arabic decimal separators are accepted; grouping separators must have valid three-digit groups. Ambiguous comma decimals and exponential/hexadecimal strings are rejected. Custom meals use the same numeric parser, and backups validate numeric entries before restoring.

Database CHECK constraints enforce food macros 0–10,000 g per entry, water 1–10,000 ml per entry, finite positive weight/waist, and body fat 0–100%. Nullable daily targets allow calories 0–100,000, macros 0–10,000 and water 1–100,000 ml. These are technical integrity bounds, not dietary recommendations. Existing calorie constraints remain in place. All-null historical body rows remain restorable; the normal entry form requires a measurement.

The live preflight found zero records violating these new checks. No existing entries were changed or deleted.

## CSV safety (R8)

The admin CSV exporter quotes every field, escapes embedded quotes and preserves commas, newlines and Arabic names. Formula-like text, leading control/format characters and full-width formula prefixes receive a visible `text: ` prefix. Numeric XP/PV values remain numbers, including negative ledger balances. A UTF-8 BOM and CRLF line endings support spreadsheet import.

The export explains the marker in the UI. It is a reporting format, not a backup/restore format. Tests independently parse generated CSV and inspect an actual browser download; desktop Excel/LibreOffice save-and-reopen behavior has not been independently exercised. The marker is deliberately visible rather than relying solely on quote or apostrophe behavior; see [OWASP CSV injection guidance](https://community.owasp.org/attacks/CSV_Injection).

## Complete analytics and member management (R9)

`get_admin_analytics()` returns one JSON snapshot containing the complete member roster and aggregated XP, PV, workouts, engagement and pending approvals. Aggregation happens in Postgres, avoiding the previous REST row caps. Totals and roster share one SQL statement snapshot. Seven/thirty-day windows include today and the preceding six/twenty-nine Cairo calendar days, excluding future workouts. PV issued counts positive ledger entries excluding refunds; balances still include refunds and spending.

The function uses SECURITY INVOKER, retains RLS and requires an active admin. Anonymous, member, coach and paused-admin calls are denied. No public client-callable security-definer function was introduced. A partial index covers member/finished-workout queries.

The client validates snapshot shape and roster completeness, displays its timestamp and permits refresh/retry. Failed analytics fetches show an error and disable export instead of presenting zero totals or exporting stale data. Member tables display 50 rows per page; CSV includes the entire snapshot. Member management and target/program selectors fetch all REST pages in stable order. Member search covers the complete loaded roster. The audit panel explicitly searches only its latest 200 events and exposes fetch failures.

One JSON snapshot is appropriate for the current app; a much larger organization may eventually need streamed exports or dedicated reporting infrastructure. This change does not establish an unlimited-scale performance guarantee.

## Database deployment and verification

Migration `20261026012642_analytics_and_numeric_integrity.sql` is applied to the existing connected Supabase project. Live-generated TypeScript types were refreshed. Read-only catalog checks confirmed all four new checks are validated, the RPC is security-invoker and there are zero public non-trigger security-definer functions executable by authenticated clients.

| Check                                               | Result                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- |
| Unit tests                                          | 97 passed                                                  |
| Mobile browser scenarios                            | 27 passed across the full run and corrected-selector rerun |
| New integrity suite                                 | 57 assertions                                              |
| Member/database suite                               | 24 assertions across all 23 migrations                     |
| Authorization suite                                 | 49 assertions                                              |
| Photo privacy suite                                 | 15 assertions                                              |
| Performance/access suite                            | 720 comparisons                                            |
| TypeScript / production build / changed-file ESLint | Passed                                                     |

The new isolated Postgres suite uses 1,205 members and over 10,000 XP events to verify complete totals, Cairo boundaries, refunds, denied roles and invalid direct API values. Browser mocks exercise a 1,105-member export, paging/search under a 100-row REST cap, fetch failures/retry and Arabic numeric input. These checks do not create live test accounts or constitute a multi-connection load test.

```sh
npm test
npm run test:integrity
npm run test:db
npm run test:security
npm run test:photos
npm run test:performance
npm run typecheck
npm run build
npm run test:e2e
```

Hosted advisors report no new security or performance WARN findings. The existing [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) warning remains; private receipt-table RLS and unused-index INFO notices are retained.

Remaining review work: R5 archived exercise history, R11 redemption retry identity, R12 consistent dates, R13 older-photo selection and the separately tracked hosted Auth/deployment and device-acceptance work.
