import { NativeSelect } from "@/components/ui/native-select";
import { adminDate } from "@/lib/admin-format";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { normalizeExercise } from "@/lib/exercise-guidance";
import { PageHeader } from "@/components/page-header";
import { StaffSummary } from "@/components/staff-summary";
import { MemberSections } from "@/components/member-sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminDraftWarning } from "@/components/admin-editor-drawer";
import { PvClaimEditor, PvTaskManager } from "@/components/admin-pv-editors";
import { loadClaimQueue, loadPvTasks, pvSearch } from "@/lib/admin-pv";

export const Route = createFileRoute("/_authenticated/_shell/admin/pv")({
  validateSearch: pvSearch,
  head: () => ({
    meta: [
      { title: "PV approvals — Prime Fitness Admin" },
      { name: "description", content: "Create PV Points tasks and review member claims." },
      { property: "og:title", content: "PV approvals — Prime Fitness Admin" },
      { property: "og:description", content: "Create PV Points tasks and review member claims." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext(),
    search = Route.useSearch(),
    navigate = Route.useNavigate();
  const { data: me } = useMe(user.id),
    { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const allowed = !!me?.isAdmin && !!me.profile?.access_active,
    section = search.section ?? "queue",
    status = search.status ?? "pending";
  const [visited, setVisited] = useState<string[]>([]),
    [dirty, setDirty] = useState<Record<string, boolean>>({});
  const reportDirty = useCallback(
    (id: string, value: boolean) =>
      setDirty((old) => (old[id] === value ? old : { ...old, [id]: value })),
    [],
  );
  useEffect(() => {
    if (search.claim)
      setVisited((old) => (old.includes(search.claim!) ? old : [...old, search.claim!]));
  }, [search.claim]);
  const queue = useQuery({
    queryKey: ["admin-pv-queue", user.id, status],
    enabled: allowed && section === "queue",
    retry: false,
    queryFn: ({ signal }) => loadClaimQueue(status, signal),
  });
  const tasks = useQuery({
    queryKey: ["admin-pv-tasks", user.id],
    enabled: allowed && section === "tasks",
    retry: false,
    queryFn: ({ signal }) => loadPvTasks(signal),
  });
  const people = useMemo(() => new Map(queue.data?.people.map((p) => [p.id, p])), [queue.data]);
  const rows = (queue.data?.claims ?? []).filter((c) =>
    normalizeExercise(
      `${people.get(c.member_id)?.display_name ?? ""} ${people.get(c.member_id)?.email ?? ""} ${c.pv_tasks?.title_en ?? ""} ${c.pv_tasks?.title_ar ?? ""}`,
    ).includes(normalizeExercise(search.q ?? "")),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    page = Math.min(search.page ?? 1, pages);
  const statusName = (value: string) =>
    value === "approved"
      ? t("approved")
      : value === "rejected"
        ? t("rejected")
        : value === "needs_info"
          ? l("Needs information", "يحتاج معلومات")
          : t("pending");
  // Cards and rows share the existing editor/retry identity; presentation never approves a claim.
  const openClaim = (id: string) => (
    <Button
      variant="outline"
      data-claim-opener={id}
      aria-expanded={search.claim === id}
      disabled={!!queue.error}
      onClick={() => void navigate({ search: (old) => ({ ...old, claim: id }) })}
    >
      {l("Open claim", "فتح الطلب")}
    </Button>
  );
  if (me && !allowed) return <p className="mt-10 text-muted-foreground">{t("notAllowed")}</p>;
  return (
    <>
      <div
        data-review-overview
        className="grid items-end gap-4 border-b border-border pb-4 lg:grid-cols-[minmax(0,1fr)_400px]"
      >
        <div>
          <PageHeader eyebrow={l("Review workspace", "مساحة المراجعة")} title={t("pvApprovals")} />
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            {l(
              "Review member evidence before making a decision. PV Points are awarded only after server approval.",
              "راجع دليل العضو قبل اتخاذ القرار. تُمنح نقاط PV بعد موافقة الخادم فقط.",
            )}
          </p>
        </div>
        {section === "queue" && (
          <div>
            {/* The queue read is status-scoped: these are not all-time claim totals. */}
            <StaffSummary
              compact
              label={l("Selected status overview", "ملخص الحالة المحددة")}
              items={[
                {
                  label: l("Claims in selected status", "طلبات الحالة المحددة"),
                  value: queue.error ? undefined : queue.data?.claims.length,
                },
                {
                  label: l("Matching claims", "الطلبات المطابقة"),
                  value: queue.data && !queue.error ? rows.length : undefined,
                },
              ]}
            />
          </div>
        )}
      </div>
      <MemberSections
        appearance="underline"
        label={l("PV administration", "إدارة نقاط PV")}
        value={section}
        items={[
          ["queue", l("Review queue", "قائمة المراجعة")],
          ["tasks", l("Task management", "إدارة المهام")],
        ]}
        onSelect={(value) =>
          void navigate({ search: { section: value === "tasks" ? "tasks" : undefined } })
        }
      />
      <section
        hidden={section !== "queue"}
        aria-label={l("Claim queue", "قائمة الطلبات")}
        className="mt-6 space-y-5"
      >
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-3">
          <label className="text-sm min-w-0 max-w-full block">
            {l("Claim status", "حالة الطلب")}
            <NativeSelect
              className="mt-2"
              value={status}
              onChange={(e) =>
                void navigate({
                  search: (old) => ({
                    ...old,
                    status:
                      e.target.value === "pending"
                        ? undefined
                        : (e.target.value as "needs_info" | "reviewed"),
                    page: undefined,
                  }),
                })
              }
            >
              <option value="pending">{t("pending")}</option>
              <option value="needs_info">{l("Needs information", "يحتاج معلومات")}</option>
              <option value="reviewed">{l("Reviewed", "تمت مراجعته")}</option>
            </NativeSelect>
          </label>
          <label className="w-full max-w-sm text-sm">
            {l("Search claims", "بحث الطلبات")}
            <Input
              className="mt-1"
              value={search.q ?? ""}
              placeholder={l("Member, email or task", "العضو أو البريد الإلكتروني أو المهمة")}
              onChange={(e) =>
                void navigate({
                  search: (old) => ({ ...old, q: e.target.value || undefined, page: undefined }),
                  replace: true,
                })
              }
            />
          </label>
        </div>
        {queue.isPending && <p role="status">{l("Loading claims…", "جارٍ تحميل الطلبات…")}</p>}
        {queue.error && (
          <div role="alert" className="text-sm text-destructive">
            {l(
              "The complete review queue could not be loaded. Displayed records may be out of date.",
              "تعذر تحميل قائمة المراجعة كاملة. قد تكون البيانات المعروضة قديمة.",
            )}
            <Button variant="outline" onClick={() => void queue.refetch()}>
              {l("Retry claims", "إعادة تحميل الطلبات")}
            </Button>
          </div>
        )}
        {!queue.isPending && !queue.error && !rows.length && (
          <p role="status" className="text-sm text-muted-foreground">
            {l("No claims match this view.", "لا توجد طلبات تطابق هذا العرض.")}
          </p>
        )}
        {/* Keep editors mounted with the queue across section changes. The same
              claim component owns drafts while its frame switches at desktop width. */}
        <div
          data-claim-workspace
          className={`grid min-w-0 items-start gap-6 ${search.claim ? "xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : ""}`}
        >
          <div className="min-w-0 space-y-4">
            <ul className="grid gap-4 md:hidden">
              {rows.slice((page - 1) * 25, page * 25).map((claim) => (
                <li
                  key={claim.id}
                  className="flex min-w-0 flex-col items-start gap-3 rounded-xl border border-border bg-card p-5"
                >
                  {/* Flex items need an explicit width bound for long names, URLs and task tokens. */}
                  <p className="min-w-0 max-w-full [overflow-wrap:anywhere] font-medium">
                    {people.get(claim.member_id)?.display_name ||
                      people.get(claim.member_id)?.email ||
                      l("Member unavailable", "بيانات العضو غير متاحة")}
                  </p>
                  <p className="min-w-0 max-w-full [overflow-wrap:anywhere] text-sm">
                    {locale === "ar"
                      ? claim.pv_tasks?.title_ar || claim.pv_tasks?.title_en
                      : claim.pv_tasks?.title_en}{" "}
                    · <bdi className="text-gold">{claim.pv_tasks?.points ?? "—"} PV</bdi>
                  </p>
                  <p className="max-w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                    <bdi>{adminDate(claim.created_at, locale)}</bdi> · {statusName(claim.status)}
                  </p>
                  {claim.review_note && (
                    <p className="min-w-0 max-w-full line-clamp-2 [overflow-wrap:anywhere] text-sm text-muted-foreground">
                      {claim.review_note}
                    </p>
                  )}
                  <div className="mt-auto w-full [&_button]:w-full">{openClaim(claim.id)}</div>
                </li>
              ))}
            </ul>
            <div
              role="region"
              aria-label={l("Claim review table", "جدول مراجعة الطلبات")}
              tabIndex={0}
              className="hidden min-w-0 max-w-full overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold md:block"
            >
              <table className="w-full min-w-[720px] text-sm [&_td:last-child]:sticky [&_td:last-child]:end-0 [&_td:last-child]:bg-card [&_th:last-child]:sticky [&_th:last-child]:end-0 [&_th:last-child]:bg-background">
                <thead className="bg-background text-xs text-muted-foreground [&_th]:px-4 [&_th]:py-3 [&_th]:text-start">
                  <tr>
                    {[
                      l("Member", "العضو"),
                      l("Task", "المهمة"),
                      l("Submitted", "تاريخ التقديم"),
                      "PV",
                      l("Status", "الحالة"),
                      l("Action", "الإجراء"),
                    ].map((label) => (
                      <th scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border [&_td]:px-4 [&_td]:py-4">
                  {rows.slice((page - 1) * 25, page * 25).map((claim) => (
                    <tr
                      key={claim.id}
                      data-selected={search.claim === claim.id || undefined}
                      className={search.claim === claim.id ? "bg-raised" : undefined}
                    >
                      <td className="max-w-48 [overflow-wrap:anywhere] font-medium">
                        {people.get(claim.member_id)?.display_name ||
                          people.get(claim.member_id)?.email ||
                          l("Member unavailable", "بيانات العضو غير متاحة")}
                      </td>
                      <td className="max-w-64 [overflow-wrap:anywhere]">
                        {locale === "ar"
                          ? claim.pv_tasks?.title_ar || claim.pv_tasks?.title_en
                          : claim.pv_tasks?.title_en}
                        {claim.review_note && (
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                            {claim.review_note}
                          </p>
                        )}
                      </td>
                      <td className="text-xs text-muted-foreground">
                        <bdi>{adminDate(claim.created_at, locale)}</bdi>
                      </td>
                      <td className="tabular-nums text-gold">
                        <bdi>{claim.pv_tasks?.points ?? "—"}</bdi>
                      </td>
                      <td>{statusName(claim.status)}</td>
                      <td>{openClaim(claim.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <nav
                aria-label={l("Claim pages", "صفحات الطلبات")}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => void navigate({ search: (old) => ({ ...old, page: page - 1 }) })}
                >
                  {l("Previous claims", "الطلبات السابقة")}
                </Button>
                <span>
                  <bdi>
                    {page} / {pages}
                  </bdi>
                </span>
                <Button
                  variant="outline"
                  disabled={page === pages}
                  onClick={() => void navigate({ search: (old) => ({ ...old, page: page + 1 }) })}
                >
                  {l("Next claims", "الطلبات التالية")}
                </Button>
              </nav>
            )}
          </div>
          <div className="min-w-0 self-start xl:sticky xl:top-20">
            {visited.map((id) => (
              <PvClaimEditor
                key={id}
                actor={user.id}
                id={id}
                open={section === "queue" && search.claim === id}
                close={() => void navigate({ search: (old) => ({ ...old, claim: undefined }) })}
                enabled={allowed}
                onDirty={reportDirty}
              />
            ))}
          </div>
        </div>
      </section>
      <div hidden={section !== "tasks"}>
        <PvTaskManager
          actor={user.id}
          enabled={allowed}
          visible={section === "tasks"}
          tasks={tasks}
          onDirty={reportDirty}
        />
      </div>
      <AdminDraftWarning dirty={allowed && Object.values(dirty).some(Boolean)} />
    </>
  );
}
