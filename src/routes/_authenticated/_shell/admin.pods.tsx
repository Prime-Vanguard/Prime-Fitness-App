import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeExercise } from "@/lib/exercise-guidance";
import { loadPods, loadPodPeople, podSearch, type PodData, type Pod } from "@/lib/admin-pods";
import { PodCreator, PodRoster } from "@/components/admin-pod-editors";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/_shell/admin/pods")({
  validateSearch: podSearch,
  head: () => ({
    meta: [
      { title: "Pods — Prime Fitness Admin" },
      { name: "description", content: "Create pods, choose pod leaders and manage pod members." },
      { property: "og:title", content: "Pods — Prime Fitness Admin" },
      {
        property: "og:description",
        content: "Create pods, choose pod leaders and manage pod members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: me } = useMe(user.id);
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const allowed = !!me?.isAdmin && !!me.profile?.access_active;
  const qc = useQueryClient();
  const key = ["admin-pods", user.id];
  const [createOpen, setCreateOpen] = useState(false);
  const [visited, setVisited] = useState<Pod[]>([]);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const reportDirty = useCallback(
    (id: string, value: boolean) =>
      setDirty((old) => (old[id] === value ? old : { ...old, [id]: value })),
    [],
  );
  const pods = useQuery({
    queryKey: key,
    retry: false,
    enabled: allowed,
    queryFn: ({ signal }) => loadPods(signal),
  });
  const people = useQuery({
    queryKey: ["admin-pod-people", user.id],
    retry: false,
    enabled: allowed && (createOpen || !!search.pod),
    queryFn: ({ signal }) => loadPodPeople(signal),
  });
  const selected = pods.data?.pods.find((p) => p.id === search.pod);
  useEffect(() => {
    if (selected)
      setVisited((old) => (old.some((p) => p.id === selected.id) ? old : [...old, selected]));
  }, [selected]);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      allowed && Object.values(dirty).some(Boolean) && current.pathname !== next.pathname,
    withResolver: true,
    enableBeforeUnload: () => allowed && Object.values(dirty).some(Boolean),
  });
  const indexes = useMemo(() => {
    const leaders = new Map(pods.data?.leaders.map((p) => [p.id, p]));
    const counts = new Map<string, number>();
    for (const row of pods.data?.memberships ?? [])
      counts.set(row.pod_id, (counts.get(row.pod_id) ?? 0) + 1);
    return { leaders, counts };
  }, [pods.data]);
  const leaderName = (id: string | null) =>
    id
      ? indexes.leaders.get(id)?.display_name ||
        indexes.leaders.get(id)?.email ||
        l("Leader unavailable", "بيانات القائد غير متاحة")
      : l("No leader assigned", "لم يتم تعيين قائد");
  const term = normalizeExercise(search.q ?? "");
  const filtered = (pods.data?.pods ?? []).filter((p) =>
    normalizeExercise(`${p.name} ${leaderName(p.leader_id)}`).includes(term),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const page = Math.min(search.page ?? 1, pages);
  async function refresh() {
    await qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["my-members"] });
    void qc.invalidateQueries({ queryKey: ["gamification"] });
  }
  function acceptedPod(pod: Pod) {
    qc.setQueryData<PodData>(key, (old) =>
      old
        ? {
            ...old,
            pods: old.pods.some((p) => p.id === pod.id)
              ? old.pods.map((p) => (p.id === pod.id ? pod : p))
              : [...old.pods, pod],
          }
        : old,
    );
    void refresh();
  }
  if (me && !allowed) return <p className="mt-10 text-muted-foreground">{t("notAllowed")}</p>;
  return (
    <>
      <PageHeader eyebrow={t("admin")} title={t("pods")} />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        {l(
          "Review Pod summaries, then open a roster to manage members and leadership.",
          "راجع ملخصات المجموعات، ثم افتح قائمة الأعضاء لإدارة العضوية والقيادة.",
        )}
      </p>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <label className="w-full max-w-sm text-sm">
          {l("Search Pods", "بحث المجموعات")}
          <Input
            className="mt-1"
            value={search.q ?? ""}
            maxLength={150}
            onChange={(e) =>
              void navigate({
                search: (old) => ({ ...old, q: e.target.value || undefined, page: undefined }),
                replace: true,
              })
            }
            placeholder={l("Pod name or leader", "اسم المجموعة أو القائد")}
          />
        </label>
        <Button
          disabled={!allowed || !!pods.error || pods.isPending}
          onClick={() => setCreateOpen(true)}
        >
          {t("createPod")}
        </Button>
      </div>
      {message && (
        <p role="status" className="mt-4 text-sm text-success">
          {message}
        </p>
      )}
      {pods.isPending && (
        <p role="status" className="mt-5">
          {l("Loading Pods…", "جارٍ تحميل المجموعات…")}
        </p>
      )}
      {pods.error && (
        <div role="alert" className="mt-5 text-sm text-destructive">
          {l(
            "The complete Pod list could not be loaded. Displayed data may be out of date; changes are paused.",
            "تعذر تحميل قائمة المجموعات كاملة. قد تكون البيانات المعروضة قديمة؛ تم إيقاف التعديلات مؤقتاً.",
          )}
          <Button variant="outline" onClick={() => void pods.refetch()}>
            {l("Retry Pods", "إعادة تحميل المجموعات")}
          </Button>
        </div>
      )}
      {!pods.isPending && !pods.error && (
        <p role="status" className="mt-4 text-xs text-muted-foreground">
          {filtered.length} {l("Pods", "مجموعة")}
        </p>
      )}
      {!pods.isPending && !pods.error && !filtered.length && (
        <p className="mt-4 text-sm">
          {search.q
            ? l("No Pods match your search.", "لا توجد مجموعات تطابق البحث.")
            : l(
                "No Pods yet. Create your first Pod to get started.",
                "لا توجد مجموعات بعد. أنشئ أول مجموعة للبدء.",
              )}
        </p>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.slice((page - 1) * 20, page * 20).map((pod) => (
          <section
            key={pod.id}
            aria-label={pod.name}
            className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="break-words font-display text-lg font-bold">{pod.name}</h2>
            <p className="break-words text-sm text-muted-foreground">
              {t("leader")}: {leaderName(pod.leader_id)}
            </p>
            <p className="text-sm">
              <bdi>{indexes.counts.get(pod.id) ?? 0}</bdi> {l("members", "عضو")}
            </p>
            <Button
              variant="outline"
              disabled={!!pods.error}
              onClick={() => void navigate({ search: (old) => ({ ...old, pod: pod.id }) })}
            >
              {l("Manage roster", "إدارة الأعضاء")}
            </Button>
          </section>
        ))}
      </div>
      {pages > 1 && (
        <nav
          aria-label={l("Pod pages", "صفحات المجموعات")}
          className="mt-5 flex items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => void navigate({ search: (old) => ({ ...old, page: page - 1 }) })}
          >
            {l("Previous Pods", "المجموعات السابقة")}
          </Button>
          <span className="text-sm">
            <bdi>
              {page} / {pages}
            </bdi>
          </span>
          <Button
            variant="outline"
            disabled={page === pages}
            onClick={() => void navigate({ search: (old) => ({ ...old, page: page + 1 }) })}
          >
            {l("Next Pods", "المجموعات التالية")}
          </Button>
        </nav>
      )}
      {search.pod && !selected && !pods.isPending && !pods.error && (
        <div role="alert" className="mt-5 text-sm">
          {l("This Pod is no longer available.", "هذه المجموعة لم تعد متاحة.")}
          <Button
            variant="ghost"
            onClick={() => void navigate({ search: (old) => ({ ...old, pod: undefined }) })}
          >
            {l("Close roster", "إغلاق قائمة الأعضاء")}
          </Button>
        </div>
      )}
      <PodCreator
        actor={user.id}
        open={createOpen}
        close={() => setCreateOpen(false)}
        people={people}
        enabled={allowed && !pods.error}
        onDirty={reportDirty}
        onSaved={(pod) => {
          acceptedPod(pod);
          setMessage(l(`Pod “${pod.name}” created.`, `تم إنشاء المجموعة «${pod.name}».`));
          setCreateOpen(false);
          void navigate({ search: (old) => ({ ...old, pod: pod.id }) });
        }}
      />
      {visited.map((snapshot) => (
        <PodRoster
          key={snapshot.id}
          actor={user.id}
          pod={pods.data?.pods.find((p) => p.id === snapshot.id) ?? snapshot}
          open={search.pod === snapshot.id && !!selected}
          close={() => void navigate({ search: (old) => ({ ...old, pod: undefined }) })}
          available={!!pods.data?.pods.some((p) => p.id === snapshot.id)}
          enabled={allowed && !pods.error}
          people={people}
          memberships={(pods.data?.memberships ?? []).filter((r) => r.pod_id === snapshot.id)}
          onDirty={reportDirty}
          onPod={acceptedPod}
          onRefresh={() => void refresh()}
          reloadPod={async () => {
            const result = await pods.refetch();
            if (result.error) throw result.error;
            const latest = result.data?.pods.find((p) => p.id === snapshot.id);
            if (!latest)
              throw new Error("This Pod is no longer available. Your draft is retained.");
            return latest;
          }}
          onMembership={(row, removed) => {
            qc.setQueryData<PodData>(key, (old) =>
              old
                ? {
                    ...old,
                    memberships: removed
                      ? old.memberships.filter(
                          (r) =>
                            !(
                              r.pod_id === row.pod_id &&
                              r.member_id === row.member_id &&
                              r.created_at === row.created_at
                            ),
                        )
                      : [
                          ...old.memberships.filter(
                            (r) => !(r.pod_id === row.pod_id && r.member_id === row.member_id),
                          ),
                          row,
                        ],
                  }
                : old,
            );
            void refresh();
          }}
        />
      ))}
      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {l("Unsaved Pod drafts", "مسودات مجموعات غير محفوظة")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {l(
                "Leaving this page discards typed Pod names, leader selections and unsubmitted member selections. A request with an uncertain response may already be saved; retry it before leaving.",
                "مغادرة الصفحة تزيل أسماء المجموعات واختيارات القادة والأعضاء غير المحفوظة. قد يكون الطلب ذو الاستجابة غير المؤكدة قد حُفظ بالفعل؛ أعد المحاولة قبل المغادرة.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{l("Keep editing", "متابعة التعديل")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (blocker.status === "blocked") blocker.proceed();
              }}
            >
              {l("Discard and continue", "إزالة المسودات والمتابعة")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
