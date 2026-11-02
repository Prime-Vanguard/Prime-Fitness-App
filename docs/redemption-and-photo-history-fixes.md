# Redemption retries and photo history

Implemented and verified **28 October 2026, Africa/Cairo**. Resolves **R11** and **R13** from the [application review](reviews/2026-10-26-application-review.md).

## R11 — one purchase intent, one debit

The Rewards page previously inserted a new redemption on each attempt. Losing an accepted response could produce another request and PV debit when the member retried.

The app now commits a stable request UUID, reward and confirmed price to member/project-scoped IndexedDB before submitting anything. Concurrent local reservations for the same unresolved reward reuse that UUID. An immediate in-memory lock and disabled buttons protect against double actions during submission; storage failure prevents submission.

`request_redemption(member, request, reward, expected_cost)` is a security-invoker RPC. It checks the intended member against the authenticated actor, requires active membership, locks the member/request identity and returns an existing own receipt before considering another insert. Existing triggers retain authority over stock, balances, debits and refunds. The confirmed price is checked under the reward's existing lock; the server cannot silently charge a changed price.

Uncertain outcomes remain under **Rewards → Unconfirmed reward requests**, including after refresh/restart. **Check / retry request** sends the original UUID and reconciles its receipt, even if the reward has since sold out or been archived. A rejected/refunded receipt remains the outcome of that request; retrying it does not create another purchase. Once a receipt is acknowledged locally, another confirmed purchase gets a fresh UUID. Reconfirming a changed price retains the same UUID.

Requests are never spent automatically on reconnect. Account switches cannot submit another member's intent: both the client and RPC bind the intended actor. Generic device-data removal is blocked while unresolved reward requests remain, so that removal cannot silently erase the only local retry identity. Uncertain requests have no unsafe local discard button; reconcile them before removal.

Forward migration [`20261028140931_redemption_retry_identity.sql`](../supabase/migrations/20261028140931_redemption_retry_identity.sql) is applied to the existing project. It adds the guarded invoker RPC and price check; it does not reset data or change stock/refund rules. Generated TypeScript types were refreshed. The database now has 32 migrations.

## R13 — complete, independent photo browsing

The old comparison shared the gallery's latest 30 photos. Both screens can now browse older history without fetching the entire library or signing URLs for hidden photos.

- The gallery loads 30 photos per page with one metadata lookahead, ordered by photo date, creation time and ID. **Older photos** and **Newer photos** navigate history.
- **Comparison photo history** has independent paging, pose and date filters. Before/after selections remain pinned while browsing other pages or dates, allowing an early photo to be compared with a recent one. Changing pose starts a separate comparison.
- Gallery signing covers only the current visible page. Comparison signing covers only the two selected photos, after rereading their authorized metadata. URLs are mapped by path, not assumed response order. Deleted/inaccessible selections are removed with a visible message.
- One-hour signed URLs refresh periodically and on stale-window focus. Failed image loads request one automatic renewal per mounted photo; concurrent renewal requests are coalesced. **Retry photo** forces a new image load and manual renewal. A missing file cannot cause an automatic renewal loop.
- Metadata reads have explicit timeouts and surface failures promptly instead of layering SDK retries underneath query retries. Gallery, comparison-history and selected-photo failures have persistent error/retry controls. They do not become an empty-gallery message.
- Existing member/coach/admin permissions, upload normalization and durable deletion handling remain authoritative. New history UI is bilingual and keyboard accessible. Authenticated responses and photos remain outside service-worker caches.

The existing member/date index supports these reads; deterministic tie ordering does not change photo ownership or storage policy.

## Verification

| Check                          | Result                                                   |
| ------------------------------ | -------------------------------------------------------- |
| Full unit suite                | 155 passing in 27 files                                  |
| Full mobile Chromium suite     | 37 passing                                               |
| Redemption database checks     | 17 passing                                               |
| Security                       | 49 passing                                               |
| Photo privacy                  | 15 passing                                               |
| Data integrity                 | 57 passing                                               |
| Training database checks       | 50 passing                                               |
| General member database checks | All 32 migrations replayed; 24 assertions passing        |
| Historical policy performance  | 720 comparisons passing                                  |
| TypeScript / production build  | Passing                                                  |
| Repository ESLint              | Zero errors; seven existing Fast Refresh export warnings |

New evidence includes concurrent local intent reservation, storage failure before submission, lost-response persistence, account isolation, price confirmation, duplicate legacy inserts rolling back, repeat purchases, rejection/refund recovery, unauthorized access, pagination beyond 30 photos, cross-page selection, bounded URL renewal and persistent query errors.

The browser lost-response scenario stores the simulated accepted request before aborting its HTTP response, then verifies one request/debit after refresh and retry. A separate purchase is verified to use another UUID. Isolated database tests independently check actual stock/ledger effects and rollback. Browser HTTP mocks are not live financial transactions.

Live checks confirm the RPC uses security-invoker, authenticated access is granted, anonymous execution is denied and the price guard is installed. No new security/performance advisor warning was introduced. The pre-existing leaked-password-protection warning remains.

Commands: `npm test`, `npm run test:redemptions`, `npm run test:security`, `npm run test:photos`, `npm run test:integrity`, `npm run test:training`, `npm run test:db`, `npm run test:performance`, `npm run typecheck`, `npm run lint`, `npm run build`, then `npm run test:e2e` against the production build.

Full local Supabase multi-transaction testing and physical iOS/Android checks remain release gates from the [training-depth report](training-depth-offline.md). These fixes do not turn on the staff-only training features or constitute general rollout approval.
