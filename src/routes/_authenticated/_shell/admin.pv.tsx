import { adminDate } from "@/lib/admin-format";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { normalizeExercise } from "@/lib/exercise-guidance";
import { PageHeader } from "@/components/page-header";
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
  if (me && !allowed) return <p className="mt-10 text-muted-foreground">{t("notAllowed")}</p>;
  return (
    <>
      <PageHeader eyebrow={t("admin")} title={t("pvApprovals")} />
      <MemberSections
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
      {section === "queue" && (
        <section aria-label={l("Claim queue", "قائمة الطلبات")} className="mt-6 space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm">
              {l("Claim status", "حالة الطلب")}
              <select
                className="mt-1 block min-h-11 rounded-md border border-input bg-background px-3"
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
              </select>
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
          <ul className="space-y-3">
            {rows.slice((page - 1) * 25, page * 25).map((claim) => (
              <li
                key={claim.id}
                className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5"
              >
                <p className="break-words font-medium">
                  {people.get(claim.member_id)?.display_name ||
                    people.get(claim.member_id)?.email ||
                    l("Member unavailable", "بيانات العضو غير متاحة")}
                </p>
                <p className="break-words text-sm">
                  {locale === "ar"
                    ? claim.pv_tasks?.title_ar || claim.pv_tasks?.title_en
                    : claim.pv_tasks?.title_en}{" "}
                  · <bdi className="text-gold">{claim.pv_tasks?.points ?? "—"} PV</bdi>
                </p>
                <p className="text-xs text-muted-foreground">
                  <bdi>{adminDate(claim.created_at, locale)}</bdi> ·{" "}
                  {claim.status === "approved"
                    ? t("approved")
                    : claim.status === "rejected"
                      ? t("rejected")
                      : claim.status === "needs_info"
                        ? l("Needs information", "يحتاج معلومات")
                        : t("pending")}
                </p>
                {claim.review_note && (
                  <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                    {claim.review_note}
                  </p>
                )}
                <Button
                  variant="outline"
                  disabled={!!queue.error}
                  onClick={() => void navigate({ search: (old) => ({ ...old, claim: claim.id }) })}
                >
                  {l("Open claim", "فتح الطلب")}
                </Button>
              </li>
            ))}
          </ul>
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
        </section>
      )}
      <div hidden={section !== "tasks"}>
        <PvTaskManager
          actor={user.id}
          enabled={allowed}
          visible={section === "tasks"}
          tasks={tasks}
          onDirty={reportDirty}
        />
      </div>
      {visited.map((id) => (
        <PvClaimEditor
          key={id}
          actor={user.id}
          id={id}
          open={search.claim === id}
          close={() => void navigate({ search: (old) => ({ ...old, claim: undefined }) })}
          enabled={allowed}
          onDirty={reportDirty}
        />
      ))}
      <AdminDraftWarning dirty={allowed && Object.values(dirty).some(Boolean)} />
    </>
  );
}
