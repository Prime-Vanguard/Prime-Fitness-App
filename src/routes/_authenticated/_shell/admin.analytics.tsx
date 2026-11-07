import { NativeSelect } from "@/components/ui/native-select";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useI18n, type TKey } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminAnalytics, analyticsSearch } from "@/lib/admin-analytics";
import { requireActiveAdmin } from "@/lib/admin-member-write";
import { normalizeExercise } from "@/lib/exercise-guidance";
import { adminDate } from "@/lib/admin-format";
import { csvDocument } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/_shell/admin/analytics")({
  validateSearch: analyticsSearch,
  head: () => ({
    meta: [
      { title: "Analytics — Prime Fitness Admin" },
      { name: "description", content: "Organization KPIs, member export and audit trail." },
      { property: "og:title", content: "Analytics — Prime Fitness Admin" },
      { property: "og:description", content: "Organization KPIs, member export and audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const { data: me } = useMe(user.id);
  const { t, locale } = useI18n();
  const search = Route.useSearch(),
    navigate = Route.useNavigate();
  const filter = search.filter ?? "",
    page = (search.page ?? 1) - 1;
  const setPage = (page: number) =>
    void navigate({ search: (old) => ({ ...old, page: page ? page + 1 : undefined }) });
  const setFilter = (filter: string) =>
    void navigate({ search: (old) => ({ ...old, filter: filter || undefined }), replace: true });
  const allowed = !!me?.isAdmin && !!me.profile?.access_active;
  const [exportStatus, setExportStatus] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const exportLock = useRef(false);
  const {
    data: result,
    error,
    isPending,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin-analytics", user.id],
    enabled: allowed,
    queryFn: ({ signal }) => adminAnalytics(signal),
    retry: 1,
  });
  const data = error ? undefined : result;
  const currentExport = useRef({ data, isFetching, allowed });
  currentExport.current = { data, isFetching, allowed };

  const {
    data: audit,
    error: auditError,
    refetch: retryAudit,
    isPending: auditPending,
  } = useQuery({
    queryKey: ["admin-audit", user.id],
    enabled: allowed && !!search.audit,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id,actor_id,action,target_type,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(200)
        .abortSignal(signal)
        .retry(false);
      if (error) throw error;
      return data;
    },
  });

  if (me && !allowed) return <p className="mt-10 text-muted-foreground">{t("notAllowed")}</p>;

  const who = (id: string | null) => {
    if (!id) return "system";
    const p = data?.rows.find((x) => x.id === id);
    return p?.display_name || p?.email || id.slice(0, 8);
  };

  async function exportCsv() {
    if (exportLock.current || !data || isFetching || !allowed) return;
    exportLock.current = true;
    setExporting(true);
    setExportError("");
    setExportStatus("");
    try {
      await requireActiveAdmin(user.id);
      const { data: snapshot, isFetching: refreshing, allowed: active } = currentExport.current;
      if (!snapshot || refreshing || !active)
        throw new Error("Refresh complete analytics before exporting.");
      const head = [
        "name",
        "email",
        "access_active",
        "joined",
        "xp",
        "pv_balance",
        "workouts_7d",
        "workouts_30d",
      ];
      const rows = snapshot.rows.map((r) => [
        r.display_name,
        r.email,
        r.access_active,
        r.created_at.slice(0, 10),
        r.xp,
        r.pv,
        r.w7,
        r.w30,
      ]);
      const blob = new Blob([csvDocument([head, ...rows])], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `prime-fitness-members-${new Date(snapshot.asOf).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" })}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setExportStatus(
        `${snapshot.rows.length} ${locale === "ar" ? "عضواً تم تصديرهم" : "members exported"}`,
      );
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  }

  const ordered = (data?.rows ?? [])
    .filter(
      (r) =>
        normalizeExercise(`${r.display_name ?? ""} ${r.email ?? ""}`).includes(
          normalizeExercise(search.member ?? ""),
        ) &&
        (!search.access || r.access_active === (search.access === "active")),
    )
    .sort(
      (a, b) =>
        (search.sort === "name"
          ? (a.display_name ?? a.email ?? "").localeCompare(b.display_name ?? b.email ?? "")
          : search.sort === "workouts"
            ? b.w30 - a.w30
            : b.xp - a.xp) || a.id.localeCompare(b.id),
    );
  const pages = Math.max(1, Math.ceil(ordered.length / 50));
  const currentPage = Math.min(page, pages - 1);
  const k = data?.kpi;
  const cards: [TKey, number | undefined][] = [
    ["kpiMembers", k?.members],
    ["kpiActive", k?.activeMembers],
    ["kpiEngaged", k?.engaged7],
    ["kpiWorkouts7", k?.workouts7],
    ["kpiWorkouts30", k?.workouts30],
    ["pendingClaims", k?.pendingClaims],
    ["pendingRedemptions", k?.pendingRedemptions],
    ["kpiPvIssued", k?.pvIssued],
  ];
  const fl = filter.trim().toLowerCase();
  const rowsA = (audit ?? []).filter(
    (a) =>
      !fl ||
      a.action.toLowerCase().includes(fl) ||
      (a.target_type ?? "").toLowerCase().includes(fl) ||
      who(a.actor_id).toLowerCase().includes(fl),
  );

  return (
    <>
      <PageHeader eyebrow={t("admin")} title={t("analytics")} />
      {error && (
        <div role="alert" className="mt-4 text-sm text-destructive">
          {locale === "ar"
            ? "تعذر تحميل إحصاءات كاملة. أعد المحاولة قبل التصدير."
            : "Complete analytics could not be loaded. Retry before exporting."}
          <Button variant="ghost" onClick={() => void refetch()}>
            {locale === "ar" ? "إعادة المحاولة" : "Retry analytics"}
          </Button>
        </div>
      )}
      {(isPending || isFetching) && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {locale === "ar" ? "جارٍ تحميل الإحصاءات…" : "Loading analytics…"}
        </p>
      )}
      {data && (
        <p className="mt-3 text-xs text-muted-foreground">
          {locale === "ar"
            ? "آخر ٧ و٣٠ يوماً تقويمياً بتوقيت القاهرة، بما فيها اليوم. آخر تحديث: "
            : "Last 7 and 30 Cairo calendar days, including today. Updated: "}
          {new Date(data.asOf).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", {
            timeZone: "Africa/Cairo",
          })}
        </p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(([label, v]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t(label)}</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums">{v ?? "—"}</p>
          </div>
        ))}
      </div>
      {data && (
        <details className="mt-4 rounded-xl border border-border p-4">
          <summary>
            {locale === "ar" ? "تعريفات المؤشرات والفترات" : "KPI definitions and periods"}
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            <p>
              {locale === "ar"
                ? "الأعضاء: كل الملفات الشخصية. النشطون: الحسابات ذات صلاحية وصول مفعلة، وليس النشاط الرياضي."
                : "Members counts all profiles. Active means access is enabled, rather than recent training activity."}
            </p>
            <p>
              {locale === "ar"
                ? "المتفاعلون: تمرين مكتمل مؤهل أو سجل طعام في آخر ٧ أيام. التمارين المستوردة مستبعدة من مؤشرات التدريب."
                : "Engaged members have a qualifying completed workout or food log in the last 7 days. Imported workouts are excluded from training KPIs."}
            </p>
            <p>
              {locale === "ar"
                ? "النقاط المصدرة: القيود الموجبة عدا الاسترداد؛ ليست الرصيد الحالي. طلبات النقاط تشمل المعلق وطلب المعلومات."
                : "PV issued sums positive ledger entries excluding refunds; it is not the current balance. Pending claims includes pending and needs-information claims."}
            </p>
            <p>
              <bdi>
                7d: {data.period.from7} → {data.period.to} · 30d: {data.period.from30} →{" "}
                {data.period.to}
              </bdi>{" "}
              · Africa/Cairo
            </p>
          </div>
        </details>
      )}

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">{t("members")}</h2>
          <Button variant="ghost" size="sm" disabled={isFetching} onClick={() => void refetch()}>
            {locale === "ar" ? "تحديث الإحصاءات" : "Refresh analytics"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportCsv()}
            disabled={!data || isFetching || exporting || !allowed}
          >
            <Download className="h-4 w-4" />
            {t("exportCsv")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {locale === "ar"
            ? "يشمل التصدير جميع الأعضاء. تُسبق النصوص الشبيهة بصيغ الجداول بعلامة text: للحماية."
            : "Export includes every member. Formula-like text receives a visible text: safety prefix."}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            {locale === "ar" ? "بحث الأعضاء" : "Search analytics members"}
            <Input
              className="mt-1"
              value={search.member ?? ""}
              onChange={(e) =>
                void navigate({
                  search: (old) => ({
                    ...old,
                    member: e.target.value || undefined,
                    page: undefined,
                  }),
                  replace: true,
                })
              }
            />
          </label>
          {(
            [
              [
                "access",
                locale === "ar" ? "صلاحية الوصول" : "Access filter",
                [
                  ["", locale === "ar" ? "الكل" : "All access"],
                  ["active", locale === "ar" ? "نشط" : "Active"],
                  ["paused", locale === "ar" ? "متوقف" : "Paused"],
                ],
              ],
              [
                "sort",
                locale === "ar" ? "الترتيب" : "Member sort",
                [
                  ["", locale === "ar" ? "النقاط" : "XP"],
                  ["name", locale === "ar" ? "الاسم" : "Name"],
                  ["workouts", locale === "ar" ? "تمارين ٣٠ يوماً" : "30-day workouts"],
                ],
              ],
            ] as const
          ).map(([key, label, options]) => (
            <label key={key} className="text-sm min-w-0 max-w-full block">
              {label}
              <NativeSelect
                className="mt-2"
                value={search[key] ?? ""}
                onChange={(e) =>
                  void navigate({
                    search: (old) => ({
                      ...old,
                      [key]: e.target.value || undefined,
                      page: undefined,
                    }),
                  })
                }
              >
                {options.map(([value, title]) => (
                  <option key={value} value={value}>
                    {title}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ))}
        </div>
        {exportStatus && (
          <p role="status" className="mt-3 text-success">
            {exportStatus}
          </p>
        )}
        {exportError && (
          <p role="alert" className="mt-3 text-destructive">
            {exportError}
          </p>
        )}
        {data && !ordered.length && (
          <p role="status" className="mt-4">
            {locale === "ar" ? "لا يوجد أعضاء مطابقون." : "No members match these filters."}
          </p>
        )}
        <ul
          aria-label={locale === "ar" ? "ملخصات الأعضاء" : "Member summaries"}
          className="mt-4 grid gap-3 md:hidden"
        >
          {ordered.slice(currentPage * 50, (currentPage + 1) * 50).map((r) => (
            <li key={r.id} className="min-w-0 rounded-xl border border-border p-4">
              <p className="break-words font-medium">{r.display_name || r.email}</p>
              <p className="break-words text-xs text-muted-foreground" dir="ltr">
                {r.email}
              </p>
              <p className="mt-2 text-sm">
                {r.access_active
                  ? locale === "ar"
                    ? "وصول نشط"
                    : "Access active"
                  : locale === "ar"
                    ? "وصول متوقف"
                    : "Access paused"}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {[
                  ["XP", r.xp],
                  ["PV", r.pv],
                  ["7d", r.w7],
                  ["30d", r.w30],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="text-start text-xs text-muted-foreground">
              <tr>
                <th className="py-2 text-start">{t("displayName")}</th>
                <th className="text-end">{t("xp")}</th>
                <th className="text-end">PV</th>
                <th className="text-end">7d</th>
                <th className="text-end">30d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ordered.slice(currentPage * 50, (currentPage + 1) * 50).map((r) => (
                <tr key={r.id} className={r.access_active ? "" : "text-muted-foreground"}>
                  <td className="py-2">{r.display_name || r.email}</td>
                  <td className="text-end tabular-nums">{r.xp}</td>
                  <td className="text-end tabular-nums text-gold">{r.pv}</td>
                  <td className="text-end tabular-nums">{r.w7}</td>
                  <td className="text-end tabular-nums">{r.w30}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === 0 || !data}
            onClick={() => setPage(currentPage - 1)}
          >
            {locale === "ar" ? "السابق" : "Previous members"}
          </Button>
          <span>
            {currentPage + 1} / {pages} · {ordered.length} {t("members")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage >= pages - 1 || !data}
            onClick={() => setPage(currentPage + 1)}
          >
            {locale === "ar" ? "التالي" : "Next members"}
          </Button>
        </div>
      </section>

      <Button
        className="mt-6"
        variant="outline"
        aria-expanded={!!search.audit}
        onClick={() =>
          void navigate({ search: (old) => ({ ...old, audit: old.audit ? undefined : true }) })
        }
      >
        {locale === "ar" ? "عرض أو إخفاء سجل التدقيق" : "Show / hide audit trail"}
      </Button>
      {search.audit && (
        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          {auditError && (
            <div role="alert" className="mb-3 text-sm text-destructive">
              {locale === "ar" ? "تعذر تحميل سجل التدقيق." : "Audit events could not be loaded."}
              <Button variant="ghost" size="sm" onClick={() => void retryAudit()}>
                {locale === "ar" ? "إعادة المحاولة" : "Retry audit"}
              </Button>
            </div>
          )}
          <p className="mb-2 text-xs text-muted-foreground">
            {locale === "ar"
              ? "البحث ضمن أحدث ٢٠٠ حدث تدقيق."
              : "Search covers the latest 200 audit events."}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">{t("auditTrail")}</h2>
            <Input
              className="max-w-xs"
              aria-label={locale === "ar" ? "بحث أحداث التدقيق" : "Search audit events"}
              placeholder={t("search")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {auditPending && (
            <p role="status">
              {locale === "ar" ? "جارٍ تحميل السجل..." : "Loading audit events..."}
            </p>
          )}
          {!auditPending && !auditError && !rowsA.length && (
            <p role="status">
              {locale === "ar" ? "لا توجد أحداث مطابقة." : "No audit events match this search."}
            </p>
          )}
          <ul className="mt-3 divide-y divide-border text-sm">
            {(!auditError ? rowsA : []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{who(a.actor_id)}</span> ·{" "}
                  <span className="text-gold">{a.action}</span>
                  {a.target_type ? (
                    <span className="text-muted-foreground"> · {a.target_type}</span>
                  ) : null}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {adminDate(a.created_at, locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
