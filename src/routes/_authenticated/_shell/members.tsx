import { NativeSelect } from "@/components/ui/native-select";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { useActivityDay } from "@/hooks/use-activity-day";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { levelFor, rankFor } from "@/lib/levels";
import { supabase } from "@/integrations/supabase/client";
import {
  loadCoachRoster,
  loadRosterSummaries,
  filterRoster,
  rosterSearch,
  rosterRouteSearch,
  ROSTER_PAGE_SIZE,
} from "@/lib/coach-roster";
export const Route = createFileRoute("/_authenticated/_shell/members")({
  head: () => ({
    meta: [
      { title: "My members — Prime Fitness" },
      { name: "description", content: "Coach and pod leader overview of assigned members." },
      { property: "og:title", content: "My members — Prime Fitness" },
      { property: "og:description", content: "Coach and pod leader overview of assigned members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
  validateSearch: rosterRouteSearch,
});
function Page() {
  const { user } = Route.useRouteContext(),
    { data: me, error: accessError } = useMe(user.id),
    { t, locale } = useI18n(),
    today = useActivityDay(),
    search = rosterSearch(Route.useSearch()),
    navigate = Route.useNavigate();
  const ar = locale === "ar",
    l = (en: string, arabic: string) => (ar ? arabic : en);
  const [draftSearch, setDraftSearch] = useState(search.q);
  useEffect(() => setDraftSearch(search.q), [search.q]);
  const allowed =
    !!me?.profile?.access_active &&
    (me.isAdmin || me.roles.includes("coach") || me.roles.includes("pod_leader"));
  const roster = useQuery({
    queryKey: ["my-members", user.id, me?.roles],
    enabled: allowed,
    queryFn: ({ signal }) => loadCoachRoster(user.id, signal),
  });
  const filtered = filterRoster(roster.data ?? [], search.q, search.scope),
    pages = Math.max(1, Math.ceil(filtered.length / ROSTER_PAGE_SIZE)),
    page = Math.min(search.page, pages),
    visible = filtered.slice((page - 1) * ROSTER_PAGE_SIZE, page * ROSTER_PAGE_SIZE),
    ids = visible.map((row) => row.id);
  const summaries = useQuery({
    queryKey: ["roster-summaries", user.id, ids, today],
    enabled: allowed && roster.isSuccess && ids.length > 0,
    retry: false,
    queryFn: ({ signal }) => loadRosterSummaries(ids, today, signal),
  });
  const thresholds = useQuery({
    queryKey: ["roster-thresholds", user.id],
    enabled: allowed,
    queryFn: async () => {
      const result = await supabase
        .from("level_thresholds")
        .select("level,xp_required")
        .order("level");
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const stats = new Map((summaries.data ?? []).map((row) => [row.id, row]));
  const update = (values: Partial<typeof search>) =>
    void navigate({ search: { ...search, ...values } });
  if (accessError)
    return (
      <p role="alert">
        {l(
          "Could not check roster access. Reload to retry.",
          "تعذر التحقق من صلاحية القائمة. أعد تحميل الصفحة.",
        )}
      </p>
    );
  if (!me)
    return <p role="status">{l("Loading roster access…", "جارٍ التحقق من صلاحية القائمة…")}</p>;
  if (!allowed) return <p role="status">{t("notAllowed")}</p>;
  return (
    <>
      <PageHeader title={t("myMembers")} />
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_14rem_auto]">
        <form
          className="text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: draftSearch, page: 1 });
          }}
        >
          <label>
            {l("Search members", "البحث عن الأعضاء")}
            <Input
              value={draftSearch}
              maxLength={150}
              onChange={(event) => setDraftSearch(event.target.value)}
            />
          </label>
          <Button type="submit" variant="outline" className="mt-2">
            {l("Apply member search", "تطبيق البحث")}
          </Button>
        </form>
        <label className="text-sm min-w-0 max-w-full block">
          {l("Relationship", "العلاقة")}
          <NativeSelect
            aria-label={l("Relationship", "العلاقة")}
            value={search.scope}
            onChange={(event) => update({ scope: event.target.value, page: 1 })}
            className="mt-2"
          >
            <option value="all">{l("All assigned members", "كل الأعضاء المرتبطين")}</option>
            <option value="coached">{l("Coached by me", "أتولى تدريبهم")}</option>
            <option value="pod">{l("My Pods", "مجموعاتي")}</option>
          </NativeSelect>
        </label>
        <Button
          variant="outline"
          className="self-end"
          onClick={() => {
            void roster.refetch();
            void summaries.refetch();
            void thresholds.refetch();
          }}
        >
          {l("Refresh roster", "تحديث القائمة")}
        </Button>
      </div>
      {roster.isPending ? (
        <p role="status" className="mt-4">
          {l("Loading assigned members…", "جارٍ تحميل الأعضاء المرتبطين…")}
        </p>
      ) : roster.error ? (
        <p role="alert" className="mt-4">
          {l(
            "Could not load assigned members. Your filters are retained.",
            "تعذر تحميل الأعضاء. احتُفظ بعوامل البحث.",
          )}
          <Button variant="outline" onClick={() => void roster.refetch()}>
            {l("Retry roster", "إعادة تحميل القائمة")}
          </Button>
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            {filtered.length}{" "}
            {l(
              "matching members · names sorted alphabetically",
              "أعضاء مطابقون · الأسماء مرتبة أبجديًا",
            )}
          </p>
          {(summaries.error || thresholds.error) && (
            <p role="alert" className="mt-3">
              {l(
                "Summaries are unavailable. Missing values are shown as —.",
                "الملخصات غير متاحة. تُعرض القيم المفقودة بشرطة —.",
              )}
              <Button
                variant="outline"
                onClick={() => {
                  void summaries.refetch();
                  void thresholds.refetch();
                }}
              >
                {l("Retry summaries", "إعادة تحميل الملخصات")}
              </Button>
            </p>
          )}
          {summaries.isFetching && ids.length > 0 && (
            <p role="status">{l("Updating visible summaries…", "جارٍ تحديث الملخصات الظاهرة…")}</p>
          )}
          {!filtered.length ? (
            <p className="mt-5 text-sm">
              {search.q || search.scope !== "all"
                ? l("No members match these filters.", "لا يوجد أعضاء مطابقون لعوامل البحث.")
                : t("noMembers")}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <caption className="p-3 text-start text-xs text-muted-foreground">
                  {l(
                    "Completed workout history, including imports · week uses Cairo dates · XP uses the server total.",
                    "سجل الجلسات المكتملة بما فيها المستوردة · الأسبوع وفق القاهرة · XP من إجمالي الخادم.",
                  )}
                </caption>
                <thead>
                  <tr>
                    {[t("member"), t("level"), t("lastWorkout"), t("workoutsWeek")].map((label) => (
                      <th className="p-3 text-start" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((member) => {
                    const summary = !summaries.error ? stats.get(member.id) : undefined,
                      level =
                        summary && !thresholds.error && thresholds.data?.length
                          ? levelFor(summary.xp, thresholds.data).level
                          : null,
                      rank = level == null ? null : rankFor(level),
                      canOpen = me.isAdmin || (me.roles.includes("coach") && member.coached);
                    return (
                      <tr key={member.id} className="border-t">
                        <td className="p-3">
                          {canOpen ? (
                            <Link
                              to="/members/$memberId"
                              params={{ memberId: member.id }}
                              className="inline-block min-h-11 py-2 font-medium text-gold underline"
                            >
                              {member.display_name || member.email}
                            </Link>
                          ) : (
                            <span className="font-medium">
                              {member.display_name || member.email}
                            </span>
                          )}
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.coached
                              ? l("Coached member", "عضو تحت تدريبي")
                              : l("Pod summary only", "ملخص المجموعة فقط")}
                            {member.coached && member.pod
                              ? ` · ${l("Pod member", "عضو مجموعة")}`
                              : ""}
                          </p>
                        </td>
                        <td className="p-3 tabular-nums">
                          {level == null ? "—" : `${ar ? rank?.ar : rank?.key} · ${level}`}
                          <p className="text-xs">{summary ? `${summary.xp} XP` : "—"}</p>
                        </td>
                        <td className="whitespace-nowrap p-3">
                          <bdi>{summary ? (summary.last ?? t("never")) : "—"}</bdi>
                        </td>
                        <td className="p-3 tabular-nums">{summary?.week ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && (
            <nav
              className="mt-4 flex flex-wrap items-center gap-3"
              aria-label={l("Member roster pages", "صفحات قائمة الأعضاء")}
            >
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => update({ page: page - 1 })}
              >
                {l("Previous members", "الأعضاء السابقون")}
              </Button>
              <span>
                {page}/{pages}
              </span>
              <Button
                variant="outline"
                disabled={page >= pages}
                onClick={() => update({ page: page + 1 })}
              >
                {l("Next members", "الأعضاء التالون")}
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
