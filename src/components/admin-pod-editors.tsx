import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { normalizeExercise } from "@/lib/exercise-guidance";
import {
  addPodMember,
  changePodLeader,
  createPod,
  removePodMember,
  type Pod,
  type PodCreation,
  type PodData,
  type PodPeople,
} from "@/lib/admin-pods";
import { AdminPersonPicker } from "@/components/admin-person-picker";
import { AdminChangeReview, type AdminReview } from "@/components/admin-change-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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

type PeopleResource = UseQueryResult<PodPeople, Error>;
type Common = {
  actor: string;
  open: boolean;
  close: () => void;
  enabled: boolean;
  people: PeopleResource;
  onDirty: (id: string, dirty: boolean) => void;
};
type Membership = PodData["memberships"][number];
function useDrawerHeading(open: boolean, locale: string) {
  const title = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // Reopening during Radix's exit transition can reuse the mounted scroll container.
    const frame = requestAnimationFrame(() => {
      if (content.current) content.current.scrollTop = 0;
      title.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, locale]);
  return { title, content };
}
function PeopleState({ people }: { people: PeopleResource }) {
  const { locale } = useI18n();
  return (
    <>
      {people.isPending && (
        <p role="status">
          {locale === "ar" ? "جارٍ تحميل الأعضاء والقادة…" : "Loading members and leaders…"}
        </p>
      )}
      {people.error && (
        <div role="alert" className="text-sm text-destructive">
          {locale === "ar"
            ? "تعذر تحميل الأعضاء والقادة بالكامل. تم الاحتفاظ بالاختيارات."
            : "The complete member/leader list could not be loaded. Your selections are retained."}
          <Button variant="outline" onClick={() => void people.refetch()}>
            {locale === "ar" ? "إعادة تحميل الأعضاء" : "Retry people"}
          </Button>
        </div>
      )}
    </>
  );
}
function usePeople(people: PeopleResource) {
  return useMemo(
    () => ({
      byId: new Map(people.data?.people.map((p) => [p.id, p])),
      leaders:
        people.data?.people.filter((p) => p.access_active && people.data.leaderIds.has(p.id)) ?? [],
    }),
    [people.data],
  );
}
export function PodCreator({
  actor,
  open,
  close,
  enabled,
  people,
  onDirty,
  onSaved,
}: Common & { onSaved: (pod: Pod) => void }) {
  const { t, locale } = useI18n();
  const { title, content } = useDrawerHeading(open, locale);
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [draft, setDraft] = useState(() => ({ id: crypto.randomUUID(), name: "", leader_id: "" }));
  const [review, setReview] = useState<AdminReview | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PodCreation | null>(null);
  const { leaders, byId } = usePeople(people);
  const ready = enabled && !!people.data && !people.error;
  useEffect(() => {
    onDirty("new", !!draft.name || !!draft.leader_id || !!review);
  }, [draft.name, draft.leader_id, review, onDirty]);
  function prepare(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!ready) return;
    const name = draft.name.trim();
    if (!name || name.length > 100) {
      setError(
        l("Enter a Pod name of 1–100 characters.", "أدخل اسماً للمجموعة من حرف إلى ١٠٠ حرف."),
      );
      return;
    }
    const input = pending ?? { id: draft.id, name, leader_id: draft.leader_id || null };
    setReview({
      title: l("Review new Pod", "مراجعة المجموعة الجديدة"),
      description: name,
      details: (
        <p className="break-words text-sm">
          {t("leader")}:{" "}
          {byId.get(draft.leader_id)?.display_name || byId.get(draft.leader_id)?.email || t("none")}
        </p>
      ),
      save: async () => {
        const saved = await createPod(actor, input, () => setPending(input));
        setPending(null);
        setDraft({ id: crypto.randomUUID(), name: "", leader_id: "" });
        onSaved(saved);
      },
    });
  }
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next && !review) close();
        }}
      >
        <SheetContent
          ref={content}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (content.current) content.current.scrollTop = 0;
            title.current?.focus({ preventScroll: true });
          }}
          side={locale === "ar" ? "left" : "right"}
          className="w-full overflow-y-auto sm:max-w-lg"
          onInteractOutside={(event) => {
            if (review) event.preventDefault();
          }}
        >
          <SheetHeader>
            <SheetTitle ref={title} tabIndex={-1}>
              {t("createPod")}
            </SheetTitle>
            <SheetDescription>
              {l(
                "Choose a name and an optional active Pod Leader. Membership is managed separately after creation.",
                "اختر اسماً وقائداً نشطاً اختيارياً. تُدار عضوية المجموعة بشكل منفصل بعد الإنشاء.",
              )}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={prepare} className="mt-6 space-y-5">
            <PeopleState people={people} />
            <label className="block text-sm">
              {t("podName")}
              <Input
                className="mt-1"
                value={draft.name}
                maxLength={100}
                disabled={!!review || !!pending}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <AdminPersonPicker
              label={t("leader")}
              emptyLabel={l("No leader assigned", "دون تعيين قائد")}
              people={leaders}
              value={draft.leader_id}
              onChange={(id) => setDraft({ ...draft, leader_id: id })}
              disabled={!ready || !!review || !!pending}
            />
            {pending && (
              <p role="status" className="text-sm">
                {l(
                  "Creation may already be saved. Review this same request to check or retry before starting another Pod.",
                  "قد يكون الإنشاء محفوظاً بالفعل. راجع الطلب نفسه للتحقق أو إعادة المحاولة قبل بدء مجموعة أخرى.",
                )}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={!ready || !!review || !draft.name.trim()}>
              {l("Review new Pod", "مراجعة المجموعة الجديدة")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {l(
                "Closing retains this draft for this page visit. Retry an uncertain save before leaving; the same request ID prevents a duplicate Pod.",
                "يبقى هذا النموذج محفوظاً عند إغلاقه خلال هذه الزيارة. أعد محاولة الحفظ غير المؤكد قبل المغادرة؛ يُستخدم معرّف الطلب نفسه لمنع إنشاء مجموعة مكررة.",
              )}
            </p>
          </form>
        </SheetContent>
      </Sheet>
      <AdminChangeReview review={review} close={() => setReview(null)} />
    </>
  );
}

export function PodRoster({
  actor,
  pod,
  open,
  close,
  enabled,
  available,
  people,
  memberships,
  onDirty,
  onPod,
  onMembership,
  onRefresh,
  reloadPod,
}: Common & {
  pod: Pod;
  available: boolean;
  memberships: Membership[];
  onPod: (pod: Pod) => void;
  onMembership: (row: Membership, removed: boolean) => void;
  onRefresh: () => void;
  reloadPod: () => Promise<Pod>;
}) {
  const { t, locale } = useI18n();
  const { title, content } = useDrawerHeading(open, locale);
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [baseline, setBaseline] = useState(pod);
  const [leader, setLeader] = useState(pod.leader_id ?? "");
  const [member, setMember] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<AdminReview | null>(null);
  const [reload, setReload] = useState(false);
  const [message, setMessage] = useState("");
  const [reloadError, setReloadError] = useState("");
  const [reloading, setReloading] = useState(false);
  const { byId, leaders } = usePeople(people);
  const dirtyLeader = leader !== (baseline.leader_id ?? "");
  const ready = enabled && available && !!people.data && !people.error && !reloading;
  useEffect(() => {
    onDirty(pod.id, dirtyLeader || !!member || !!review);
  }, [pod.id, dirtyLeader, member, review, onDirty]);
  useEffect(() => {
    if (!dirtyLeader && baseline.updated_at !== pod.updated_at) {
      setBaseline(pod);
      setLeader(pod.leader_id ?? "");
    }
  }, [dirtyLeader, baseline.updated_at, pod]);
  const name = (id: string | null) =>
    id
      ? byId.get(id)?.display_name ||
        byId.get(id)?.email ||
        l("Member unavailable", "بيانات العضو غير متاحة")
      : t("none");
  const membershipIds = useMemo(() => new Set(memberships.map((m) => m.member_id)), [memberships]);
  const availablePeople =
    people.data?.people.filter((p) => !membershipIds.has(p.id) || p.id === member) ?? [];
  const leaderOptions =
    leader && !leaders.some((p) => p.id === leader) && byId.has(leader)
      ? [
          ...leaders,
          {
            ...byId.get(leader)!,
            display_name: `${name(leader)} (${l("current selection; unavailable for new assignment", "الاختيار الحالي؛ غير متاح للتعيين الجديد")})`,
          },
        ]
      : leaders;
  const filtered = memberships.filter((row) =>
    normalizeExercise(`${name(row.member_id)} ${byId.get(row.member_id)?.email ?? ""}`).includes(
      normalizeExercise(query),
    ),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const shownPage = Math.min(page, pages);
  async function reloadLeader() {
    setReloading(true);
    setReloadError("");
    try {
      const latest = await reloadPod();
      setBaseline(latest);
      setLeader(latest.leader_id ?? "");
    } catch (failure) {
      setReloadError((failure as Error).message);
    } finally {
      setReloading(false);
    }
  }
  function reviewLeader() {
    if (!ready || !dirtyLeader) return;
    setReview({
      title: l("Review Pod leader", "مراجعة قائد المجموعة"),
      description: pod.name,
      details: (
        <div className="space-y-3 text-sm">
          <p className="break-words">
            {l("Saved leader", "القائد المحفوظ")}: {name(baseline.leader_id)}
          </p>
          <p className="break-words">
            {l("New leader", "القائد الجديد")}: {name(leader || null)}
          </p>
          <p>
            {l(
              "Changing the leader updates who leads this Pod. It does not add or remove roster membership or assign a coach.",
              "يحدد التغيير قائد هذه المجموعة. تُدار عضوية المجموعة وتعيين المدربين بشكل منفصل.",
            )}
          </p>
        </div>
      ),
      save: async () => {
        const saved = await changePodLeader(actor, baseline, leader || null);
        setBaseline(saved);
        setLeader(saved.leader_id ?? "");
        onPod(saved);
        setMessage(l("Pod leader saved.", "تم حفظ قائد المجموعة."));
      },
    });
  }
  function reviewAdd() {
    if (!ready || !member) return;
    const chosen = member;
    setReview({
      title: l("Review member addition", "مراجعة إضافة العضو"),
      description: pod.name,
      details: (
        <p className="break-words text-sm">
          {l("Add to this Pod", "إضافة إلى هذه المجموعة")}: {name(chosen)}
          <br />
          <bdi dir="ltr">{byId.get(chosen)?.email}</bdi>
        </p>
      ),
      save: async () => {
        const row = await addPodMember(actor, pod.id, chosen);
        onMembership(row, false);
        setMember("");
        setMessage(l("Member added to the Pod.", "تمت إضافة العضو إلى المجموعة."));
      },
    });
  }
  function reviewRemove(row: Membership) {
    if (!ready) return;
    setReview({
      title: l("Review member removal", "مراجعة إزالة العضو"),
      description: pod.name,
      details: (
        <div className="space-y-3 text-sm">
          <p className="break-words">
            {l("Remove from this Pod", "إزالة من هذه المجموعة")}: {name(row.member_id)}
          </p>
          <p>
            {l(
              "This removes Pod membership. The member’s account, workout history and coach assignment are retained.",
              "تزيل هذه العملية العضوية في المجموعة. يبقى حساب العضو وسجل تدريباته وتعيين مدربه محفوظاً.",
            )}
          </p>
          {row.member_id === pod.leader_id && (
            <p>
              {l(
                "This member is also the Pod leader. Leadership stays assigned until you explicitly change it.",
                "هذا العضو هو قائد المجموعة أيضاً. تبقى القيادة معيّنة حتى تغيّرها بشكل صريح.",
              )}
            </p>
          )}
        </div>
      ),
      save: async () => {
        await removePodMember(actor, pod.id, row.member_id, row.created_at);
        onMembership(row, true);
        setMessage(l("Member removed from the Pod.", "تمت إزالة العضو من المجموعة."));
      },
    });
  }
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next && !review) close();
        }}
      >
        <SheetContent
          ref={content}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (content.current) content.current.scrollTop = 0;
            title.current?.focus({ preventScroll: true });
          }}
          side={locale === "ar" ? "left" : "right"}
          className="w-full overflow-y-auto sm:max-w-xl"
          onInteractOutside={(event) => {
            if (review) event.preventDefault();
          }}
        >
          <SheetHeader>
            <SheetTitle ref={title} tabIndex={-1} className="break-words">
              {l("Manage Pod", "إدارة المجموعة")}: {pod.name}
            </SheetTitle>
            <SheetDescription>
              {memberships.length}{" "}
              {l(
                "roster members. Leader assignment and roster membership are separate.",
                "عضو في القائمة. تعيين القائد وعضوية المجموعة منفصلان.",
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-7">
            <PeopleState people={people} />
            {!enabled && (
              <p role="alert" className="text-sm text-destructive">
                {l(
                  "Changes are paused until the complete Pod list is available. Your draft is retained.",
                  "تم إيقاف التعديلات لحين توفر قائمة المجموعات كاملة. تم الاحتفاظ بمسودتك.",
                )}
              </p>
            )}
            {message && (
              <p role="status" className="text-sm text-success">
                {message}
              </p>
            )}
            <section
              aria-label={l("Pod leadership", "قيادة المجموعة")}
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <h3 className="font-medium">{l("Leadership", "القيادة")}</h3>
              {reloading && (
                <p role="status">{l("Reloading saved leader…", "جارٍ تحميل القائد المحفوظ…")}</p>
              )}
              {reloadError && (
                <p role="alert" className="text-sm text-destructive">
                  {reloadError}
                </p>
              )}
              <p className="break-words text-sm text-muted-foreground">
                {l("Saved leader", "القائد المحفوظ")}: {name(pod.leader_id)}
              </p>
              {dirtyLeader && baseline.updated_at !== pod.updated_at && (
                <p role="status" className="text-sm">
                  {l(
                    "The saved Pod changed. Your leader draft is retained; reload before reviewing the latest leader.",
                    "تغيرت بيانات المجموعة المحفوظة. تم الاحتفاظ باختيارك؛ أعد التحميل لمراجعة القائد الحالي.",
                  )}
                </p>
              )}
              <AdminPersonPicker
                label={t("leader")}
                emptyLabel={l("No leader assigned", "دون تعيين قائد")}
                people={leaderOptions}
                value={leader}
                disabled={!ready || !!review}
                onChange={setLeader}
              />
              <div className="flex flex-wrap gap-2">
                <Button disabled={!ready || !dirtyLeader || !!review} onClick={reviewLeader}>
                  {l("Review leader change", "مراجعة تغيير القائد")}
                </Button>
                <Button
                  variant="outline"
                  disabled={!ready || !!review}
                  onClick={() => setReload(true)}
                >
                  {l("Reload saved leader", "إعادة تحميل القائد المحفوظ")}
                </Button>
              </div>
            </section>
            <section
              aria-label={l("Add Pod member", "إضافة عضو للمجموعة")}
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <h3 className="font-medium">{t("addMember")}</h3>
              <AdminPersonPicker
                label={l("Member to add", "العضو المراد إضافته")}
                people={availablePeople}
                value={member}
                disabled={!ready || !!review}
                onChange={setMember}
              />
              <Button disabled={!ready || !member || !!review} onClick={reviewAdd}>
                {l("Review member addition", "مراجعة إضافة العضو")}
              </Button>
            </section>
            <section aria-label={l("Pod roster", "أعضاء المجموعة")} className="space-y-3">
              <h3 className="font-medium">{l("Roster", "قائمة الأعضاء")}</h3>
              <label className="block text-sm">
                {l("Search roster", "بحث الأعضاء")}
                <Input
                  className="mt-1"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <Button variant="outline" onClick={onRefresh}>
                {l("Refresh roster", "تحديث الأعضاء")}
              </Button>
              {!memberships.length && (
                <p className="text-sm text-muted-foreground">
                  {l(
                    "This Pod has no roster members yet.",
                    "لا يوجد أعضاء في قائمة هذه المجموعة بعد.",
                  )}
                </p>
              )}
              {!!memberships.length && !filtered.length && (
                <p className="text-sm text-muted-foreground">
                  {l("No roster members match your search.", "لا يوجد أعضاء يطابقون البحث.")}
                </p>
              )}
              <ul className="divide-y divide-border">
                {filtered.slice((shownPage - 1) * 25, shownPage * 25).map((row) => (
                  <li
                    key={row.member_id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">{name(row.member_id)}</p>
                      <p className="break-all text-xs text-muted-foreground">
                        <bdi dir="ltr">{byId.get(row.member_id)?.email}</bdi>
                      </p>
                      {byId.get(row.member_id)?.access_active === false && (
                        <p className="text-xs text-muted-foreground">
                          {l("Account paused", "الحساب موقوف")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      disabled={!ready || !!review}
                      onClick={() => reviewRemove(row)}
                    >
                      {t("remove")}
                    </Button>
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <nav
                  aria-label={l("Roster pages", "صفحات الأعضاء")}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <Button
                    variant="outline"
                    disabled={shownPage === 1}
                    onClick={() => setPage(shownPage - 1)}
                  >
                    {l("Previous members", "الأعضاء السابقون")}
                  </Button>
                  <span className="text-xs">
                    <bdi>
                      {shownPage} / {pages}
                    </bdi>
                  </span>
                  <Button
                    variant="outline"
                    disabled={shownPage === pages}
                    onClick={() => setPage(shownPage + 1)}
                  >
                    {l("Next members", "الأعضاء التاليون")}
                  </Button>
                </nav>
              )}
            </section>
            <Button variant="outline" disabled={!!review} onClick={close}>
              {l("Close roster", "إغلاق قائمة الأعضاء")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <AdminChangeReview review={review} close={() => setReview(null)} />
      <AlertDialog open={reload} onOpenChange={setReload}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {l("Discard this leader selection?", "إزالة اختيار القائد؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {l(
                "Reload the saved Pod leader from the server and replace this leader draft. The member selection is retained. A failed reload keeps your draft.",
                "أعد تحميل قائد المجموعة من الخادم واستبدل مسودة القائد. يبقى اختيار العضو محفوظاً، وفشل التحميل يحتفظ بمسودتك.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{l("Keep editing", "متابعة التعديل")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void reloadLeader()}>
              {l("Discard leader draft", "إزالة مسودة القائد")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
