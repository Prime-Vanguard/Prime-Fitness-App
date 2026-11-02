# Photo, backup and session fixes — 26 October 2026

This second patch batch resolves R7, R10 and R14 from the [application review](reviews/2026-10-26-application-review.md). R1–R4 were addressed in the [first batch](security-fixes.md). The older-photo selection limit in R13 remains open.

## Retryable photo deletion — R7

Deletion now queues an immutable, member-owned reference before contacting Storage. The app removes the file through the Storage API first and deletes the photo record only after that operation is acknowledged. Deleting the photo record cascades to its queue entry. If Storage or metadata deletion fails, the reference remains available after reload with a **Retry removal** action and a persistent warning that deletion is incomplete. The owner gallery/comparison hides queued entries while showing their pending-removal state separately.

The queue has RLS, owner-only SELECT/INSERT and no authenticated UPDATE/DELETE grants. An insertion must match the owner's existing photo ID and path. Paused members can still complete privacy deletion. Anonymous users and other members cannot read or enqueue someone else's entries.

An internal database trigger also refuses to delete a photo record while `storage.objects` still lists the file. This applies to direct metadata DELETE requests from older clients too. The guard lives in the private schema, has a fixed empty search path and is not client-callable. Physical files are removed only through the Storage API; database tests simulate Storage metadata in isolated WASM.

Uploads now create an acknowledged metadata reference before sending file bytes. A lost metadata response therefore cannot leave an uploaded object without a reference. An unconfirmed upload retains its metadata path and attempts to queue cleanup. If reconnecting is needed even to enqueue cleanup, the unfinished gallery entry can still be removed later. The app reports success only after both metadata and upload acknowledgements.

Pending progress-photo deletions are excluded from new backups. Restore refuses to upload a file while its deletion is pending, preventing an ordinary restore retry from undoing an unfinished removal. Failed gallery queries now have an explicit error/retry state.

Retry cleanup currently runs when the member uses the pending entry's button; it is not a background server job. Previously issued signed URLs and browser/CDN caches are subject to their lifetimes. This patch does not promise instant revocation of previously issued URLs; see [Supabase Storage serving guidance](https://supabase.com/docs/guides/storage/serving/downloads).

## New-upload and legacy-backup compatibility — R14

New progress uploads are decoded and re-encoded as JPEG, with a maximum edge of 2,048 pixels. Re-encoding removes source metadata and flattens transparency on white. Oversized files, SVG uploads, failed decodes and invalid dimensions receive errors before file upload. The input limit and private bucket limit are both 10 MiB. The decoded image is released even when processing fails.

HEIC and other formats depend on browser-native decoding. An unsupported input asks the member to convert it to JPEG/PNG; it is never uploaded undecoded or silently omitted. An animated input becomes a still photo.

Existing image bytes are not rewritten. Backup export/validation/restore now support legacy image MIME types such as GIF and HEIC rather than rejecting the complete backup outside JPEG/PNG/WebP. Export normalizes MIME header parameters while preserving the original bytes and checksum. The bucket permits `image/*` so legacy images remain restorable; regular new uploads use the JPEG conversion path. Backup image bytes remain opaque data, not inserted as inline markup.

Preflight read-only queries found no unreferenced Storage objects and no non-image MIME metadata in the current photo bucket. No member images were deleted or converted as part of migration deployment.

## Session and account isolation — R10

The root session listener synchronously cancels queries, clears the QueryClient and remounts route content when an identity changes or signs out. It handles SDK notifications and cross-tab auth-storage changes. Storage values are only UI invalidation signals; real route/backend authorization still verifies the session and database permissions.

Logout navigates to Auth explicitly. Duplicate logout notifications preserve the existing safe login destination. Admin queries are scoped to the signed-in identity, and the shell does not mount admin route content while permissions are missing, loading or failed. Role-query errors now propagate instead of being treated as an empty successful response.

Private component state and signed-photo query data are discarded on identity changes. A backup export finishing after its private screen unmounts cannot trigger an old-account download. Late restore callbacks also cannot apply another member's locale or success UI. Cancelled query responses cannot refill a previous identity's cache.

Unsynced workouts remain in member-scoped IndexedDB and are not erased by logout. This preserves offline work; it is UI/account isolation rather than encrypted device storage. A separate explicit device-data removal workflow remains future work.

## Verification and deployment

Applied migrations:

- `20261026005525_photo_deletion_queue.sql`
- `20261026010031_photo_storage_delete_guard.sql`

Live checks verified queue RLS and both ownership policies, denied authenticated queue rewrite/removal, the private file-first guard and its revoked client execution, an empty initial pending queue, and a private image-only bucket. Generated types were refreshed. Security and Performance Advisors reported no new WARN findings. The pre-existing [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) warning remains unchanged; internal receipt-table and unused-index INFO notices remain for review.

Validation passed on 26 October 2026:

| Check                                               | Result                                 |
| --------------------------------------------------- | -------------------------------------- |
| Unit tests                                          | 65 passed                              |
| Mobile browser scenarios                            | 24 passed                              |
| Photo privacy checks                                | 15 assertions                          |
| Authorization regression checks                     | 49 assertions                          |
| Member/database checks                              | 24 assertions across all 22 migrations |
| Progression checks                                  | 44 assertions                          |
| Reliability checks                                  | 42 assertions                          |
| Performance/access comparisons                      | 720 passed                             |
| TypeScript / production build / changed-file ESLint | Passed                                 |

New browser cases exercise failed Storage deletion followed by reload/retry, actual JPEG bytes in an upload, cleanup references after an unconfirmed upload, and Profile logout across two tabs followed by a different identity with delayed permission loading. A DOM observer verifies that cached admin member data does not reappear. Unit tests cover late-request cancellation, draft preservation, an export finishing after unmount, byte-preserving legacy-image backup/restore, pending-deletion exclusions and restore blocking.

Database tests are isolated and browser responses are mocked. No live member photo was used for destructive verification. Physical iOS/Android camera/HEIC acceptance, existing signed-URL/cache expiry behavior and real email delivery still require separate device/environment checks.

```sh
npm test
npm run test:photos
npm run test:security
npm run test:db
npm run test:progression
npm run test:reliability
npm run test:performance
npm run typecheck
npm run build
npm run test:e2e
```

The subsequent [analytics and validation batch](analytics-and-validation-fixes.md) resolves R6, R8 and R9. Remaining review work: R5 historical exercise metadata; R11 redemption retry identity; R12 consistent dates; R13 older-photo selection; and the separately tracked hosted Auth/deployment improvements.
