import { NativeSelect } from "@/components/ui/native-select";
import { adminDate } from "@/lib/admin-format";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { normalizeExercise } from "@/lib/exercise-guidance";
import {
  createPvTask,
  decidePvClaim,
  decisionInput,
  loadClaim,
  sameClaim,
  setPvTaskActive,
  taskInput,
  type ClaimContext,
  type Decision,
  type PvTask,
} from "@/lib/admin-pv";
import { AdminEditorDrawer } from "@/components/admin-editor-drawer";
import { AdminChangeReview, type AdminReview } from "@/components/admin-change-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type TaskRequest = { id: string; title_en: string; title_ar: string | null; points: number };
export function PvTaskManager({
  actor,
  enabled,
  visible,
  tasks,
  onDirty,
}: {
  actor: string;
  enabled: boolean;
  visible: boolean;
  tasks: UseQueryResult<PvTask[], Error>;
  onDirty: (id: string, dirty: boolean) => void;
}) {
  const { t, locale } = useI18n(),
    qc = useQueryClient();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [open, setOpen] = useState(false),
    [review, setReview] = useState<AdminReview | null>(null);
  const [draft, setDraft] = useState(() => ({
    id: crypto.randomUUID(),
    title_en: "",
    title_ar: "",
    points: "",
  }));
  const [pending, setPending] = useState<TaskRequest | null>(null),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1),
    [saved, setSaved] = useState(false);
  const ready = enabled && !tasks.error && !!tasks.data;
  useEffect(() => {
    onDirty(
      "task",
      !!draft.title_en || !!draft.title_ar || !!draft.points || !!pending || !!review,
    );
  }, [draft, pending, review, onDirty]);
  const rows = (tasks.data ?? []).filter(
    (task) =>
      normalizeExercise(`${task.title_en} ${task.title_ar ?? ""}`).includes(
        normalizeExercise(search),
      ) &&
      (filter === "all" || task.active === (filter === "active")),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    shown = Math.min(page, pages);
  function accepted(task: PvTask) {
    qc.setQueryData<PvTask[]>(["admin-pv-tasks", actor], (old) => [
      task,
      ...(old ?? []).filter((r) => r.id !== task.id),
    ]);
    void qc.invalidateQueries({ queryKey: ["admin-pv-tasks", actor] });
    void qc.invalidateQueries({ queryKey: ["gamification"] });
    setSaved(true);
  }
  function prepare(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!ready) return;
    try {
      const input = pending ?? { id: draft.id, ...taskInput(draft) };
      setReview({
        title: l("Review new PV task", "مراجعة مهمة PV جديدة"),
        description: locale === "ar" ? input.title_ar || input.title_en : input.title_en,
        details: (
          <p className="text-sm">
            <bdi>{input.points} PV</bdi> ·{" "}
            {l(
              "Awarded by the server only after an eligible claim is approved.",
              "يمنحها الخادم فقط بعد الموافقة على طلب مستوفٍ للشروط.",
            )}
          </p>
        ),
        save: async () => {
          const row = await createPvTask(actor, input, () => setPending(input));
          accepted(row);
          setDraft({ id: crypto.randomUUID(), title_en: "", title_ar: "", points: "" });
          setPending(null);
          setOpen(false);
        },
      });
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  function toggle(task: PvTask) {
    setReview({
      title: l("Review task visibility", "مراجعة ظهور المهمة"),
      description: locale === "ar" ? task.title_ar || task.title_en : task.title_en,
      details: (
        <p className="text-sm">
          {task.active
            ? l(
                "Hide this task from new submissions. Existing claims remain available for review.",
                "إخفاء هذه المهمة عن الطلبات الجديدة. تبقى الطلبات الحالية متاحة للمراجعة.",
              )
            : l(
                "Make this task available for new submissions.",
                "إتاحة هذه المهمة للطلبات الجديدة.",
              )}
        </p>
      ),
      save: async () => accepted(await setPvTaskActive(actor, task, !task.active)),
    });
  }
  return (
    <section aria-label={l("PV tasks", "مهام PV")} className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">
        {l(
          "Manage the tasks members can claim. Claim decisions are handled in the separate review queue.",
          "أدر المهام التي يمكن للأعضاء تقديم طلبات لها. تُراجع الطلبات في قائمة المراجعة المنفصلة.",
        )}
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="w-full max-w-sm text-sm">
          {l("Search tasks", "بحث المهام")}
          <Input
            className="mt-1"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="text-sm min-w-0 max-w-full block">
          {l("Task visibility", "ظهور المهام")}
          <NativeSelect
            className="mt-2"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">{l("All", "الكل")}</option>
            <option value="active">{t("active")}</option>
            <option value="hidden">{t("hidden")}</option>
          </NativeSelect>
        </label>
        <Button disabled={!ready} onClick={() => setOpen(true)}>
          {l("Create PV task", "إنشاء مهمة PV")}
        </Button>
      </div>
      {visible && tasks.isPending && (
        <p role="status">{l("Loading tasks…", "جارٍ تحميل المهام…")}</p>
      )}
      {tasks.error && (
        <div role="alert" className="text-sm text-destructive">
          {l(
            "Tasks could not be loaded completely. Your draft is retained.",
            "تعذر تحميل المهام بالكامل. تم الاحتفاظ بمسودتك.",
          )}
          <Button variant="outline" onClick={() => void tasks.refetch()}>
            {l("Retry tasks", "إعادة تحميل المهام")}
          </Button>
        </div>
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          {l("Task changes saved.", "تم حفظ تغييرات المهمة.")}
        </p>
      )}
      {!tasks.isPending && !tasks.error && !rows.length && (
        <p role="status" className="text-sm">
          {l("No tasks match this view.", "لا توجد مهام تطابق هذا العرض.")}
        </p>
      )}
      <ul className="space-y-3">
        {rows.slice((shown - 1) * 25, shown * 25).map((task) => (
          <li
            key={task.id}
            className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5"
          >
            <p className="break-words font-medium">
              {locale === "ar" ? task.title_ar || task.title_en : task.title_en}
            </p>
            <p className="text-sm">
              <bdi>{task.points} PV</bdi> · {task.active ? t("active") : t("hidden")}
            </p>
            <Button variant="outline" disabled={!ready || !!review} onClick={() => toggle(task)}>
              {task.active ? l("Hide task", "إخفاء المهمة") : l("Activate task", "تفعيل المهمة")}
            </Button>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav
          aria-label={l("Task pages", "صفحات المهام")}
          className="flex items-center justify-between gap-3"
        >
          <Button variant="outline" disabled={shown === 1} onClick={() => setPage(shown - 1)}>
            {l("Previous tasks", "المهام السابقة")}
          </Button>
          <span>
            <bdi>
              {shown} / {pages}
            </bdi>
          </span>
          <Button variant="outline" disabled={shown === pages} onClick={() => setPage(shown + 1)}>
            {l("Next tasks", "المهام التالية")}
          </Button>
        </nav>
      )}
      <AdminEditorDrawer
        open={visible && open}
        close={() => setOpen(false)}
        locked={!!review}
        title={l("Create PV task", "إنشاء مهمة PV")}
        description={l(
          "Set bilingual task titles and a whole-number PV award.",
          "حدد عنوانَي المهمة وقيمة مكافأة PV كعدد صحيح.",
        )}
      >
        <form onSubmit={prepare} className="space-y-5">
          <label className="block text-sm">
            {l("Title (English)", "العنوان بالإنجليزية")}
            <Input
              className="mt-1"
              dir="ltr"
              required
              maxLength={200}
              disabled={!!pending || !!review}
              value={draft.title_en}
              onChange={(e) => setDraft({ ...draft, title_en: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            {l("Title (Arabic)", "العنوان بالعربية")}
            <Input
              className="mt-1"
              dir="rtl"
              maxLength={200}
              disabled={!!pending || !!review}
              value={draft.title_ar}
              onChange={(e) => setDraft({ ...draft, title_ar: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            {l("PV points", "نقاط PV")}
            <Input
              className="mt-1"
              inputMode="numeric"
              required
              disabled={!!pending || !!review}
              value={draft.points}
              onChange={(e) => setDraft({ ...draft, points: e.target.value })}
            />
          </label>
          {pending && (
            <p role="status" className="text-sm">
              {l(
                "This task request may already be saved. Retry the same request before creating another.",
                "قد يكون طلب المهمة محفوظاً بالفعل. أعد محاولة الطلب نفسه قبل إنشاء مهمة أخرى.",
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={!ready || !!review}>
            {l("Review new PV task", "مراجعة مهمة PV جديدة")}
          </Button>
        </form>
      </AdminEditorDrawer>
      <AdminChangeReview review={review} close={() => setReview(null)} />
    </section>
  );
}

export function PvClaimEditor({
  actor,
  id,
  open,
  close,
  enabled,
  onDirty,
}: {
  actor: string;
  id: string;
  open: boolean;
  close: () => void;
  enabled: boolean;
  onDirty: (id: string, dirty: boolean) => void;
}) {
  const { t, locale } = useI18n(),
    qc = useQueryClient();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const query = useQuery({
    queryKey: ["admin-pv-claim", actor, id],
    enabled: enabled && open,
    retry: false,
    queryFn: ({ signal }) => loadClaim(id, signal),
  });
  const [snapshot, setSnapshot] = useState<ClaimContext | null>(null),
    [note, setNote] = useState(""),
    [status, setStatus] = useState<Decision>("approved");
  const [review, setReview] = useState<AdminReview | null>(null),
    [error, setError] = useState("");
  const [pending, setPending] = useState<{
    original: ClaimContext;
    status: Decision;
    note: string;
  } | null>(null);
  const [outcome, setOutcome] = useState<{
    status: string;
    awarded: number | null;
    expected: number | undefined;
  } | null>(null);
  const [reload, setReload] = useState(false),
    [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (!snapshot && query.data) setSnapshot(query.data);
  }, [query.data, snapshot]);
  useEffect(() => {
    onDirty(id, !!note || status !== "approved" || !!pending || !!review);
  }, [id, note, status, pending, review, onDirty]);
  const person = useQuery({
    queryKey: ["admin-pv-person", actor, snapshot?.member_id],
    enabled: enabled && open && !!snapshot,
    retry: false,
    queryFn: async () => {
      const result = await supabase
        .from("profiles")
        .select("id,display_name,email,access_active")
        .eq("id", snapshot!.member_id)
        .maybeSingle()
        .retry(false);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const decided = snapshot?.status === "approved" || snapshot?.status === "rejected",
    self = snapshot?.member_id === actor;
  const ready =
    enabled && !!snapshot && !!person.data && !query.error && !person.error && !reloading;
  const decisionName = (value: string) =>
    value === "approved"
      ? l("Approve", "موافقة")
      : value === "rejected"
        ? l("Reject", "رفض")
        : l("Request information", "طلب معلومات");
  async function reloadClaim() {
    setReloading(true);
    setError("");
    try {
      const result = await query.refetch();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("Claim could not be loaded.");
      if (pending && sameClaim(result.data, pending.original))
        throw new Error(
          "The previous decision is still unresolved. Retry the same saved decision before changing it.",
        );
      setSnapshot(result.data);
      setPending(null);
      setNote("");
      setStatus("approved");
      setOutcome(null);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setReloading(false);
    }
  }
  function prepare(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!ready || !snapshot || self || (decided && !pending)) return;
    try {
      const input = pending ?? {
        original: snapshot,
        status,
        note: decisionInput(status, note).review_note ?? "",
      };
      setReview({
        title: l("Review PV decision", "مراجعة قرار PV"),
        description: person.data?.display_name || person.data?.email || snapshot.member_id,
        details: (
          <div className="space-y-3 text-sm">
            <p className="break-words">
              {locale === "ar"
                ? input.original.pv_tasks?.title_ar || input.original.pv_tasks?.title_en
                : input.original.pv_tasks?.title_en}
            </p>
            <p>
              {decisionName(input.status)} · <bdi>{input.original.pv_tasks?.points ?? "—"} PV</bdi>
            </p>
            <p className="whitespace-pre-wrap break-words">
              {input.note || l("No decision note", "دون ملاحظة قرار")}
            </p>
            <p>
              {input.status === "approved"
                ? l(
                    "Approval is final and awards PV through the existing server trigger. The saved ledger receipt determines the confirmed amount.",
                    "الموافقة نهائية وتمنح نقاط PV عبر آلية الخادم الحالية. يحدد إيصال السجل المحفوظ القيمة المؤكدة.",
                  )
                : l(
                    "This decision awards no PV. The member will see the saved review feedback.",
                    "لا يمنح هذا القرار نقاط PV. يرى العضو ملاحظات المراجعة المحفوظة.",
                  )}
            </p>
          </div>
        ),
        save: async () => {
          const result = await decidePvClaim(actor, input.original, input.status, input.note, () =>
            setPending(input),
          );
          const accepted = { ...input.original, ...result.claim };
          setSnapshot(accepted);
          setPending(null);
          setNote("");
          setStatus("approved");
          setOutcome({
            status: result.claim.status,
            awarded: result.awarded,
            expected: input.original.pv_tasks?.points,
          });
          qc.setQueryData(["admin-pv-claim", actor, id], accepted);
          void qc.invalidateQueries({ queryKey: ["admin-pv-queue", actor] });
          void qc.invalidateQueries({ queryKey: ["gamification"] });
        },
      });
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  return (
    <>
      <AdminEditorDrawer
        open={open}
        close={close}
        locked={!!review || reloading}
        title={l("Claim review", "مراجعة الطلب")}
        description={
          person.data?.display_name ||
          person.data?.email ||
          l(
            "Review evidence and the saved task before deciding.",
            "راجع الدليل والمهمة المحفوظة قبل اتخاذ القرار.",
          )
        }
      >
        {query.isPending && <p role="status">{l("Loading claim…", "جارٍ تحميل الطلب…")}</p>}
        {query.error && (
          <div role="alert" className="text-sm text-destructive">
            {query.error.message}
            <Button variant="outline" onClick={() => void query.refetch()}>
              {l("Retry claim", "إعادة تحميل الطلب")}
            </Button>
          </div>
        )}
        {snapshot && (
          <>
            {person.isPending && (
              <p role="status">{l("Loading member details…", "جارٍ تحميل بيانات العضو…")}</p>
            )}
            <p className="break-all text-xs text-muted-foreground">
              <bdi dir="ltr">{person.data?.email}</bdi>
            </p>
            {person.error && (
              <div role="alert" className="text-sm text-destructive">
                {l(
                  "Member details unavailable. Your review draft is retained.",
                  "بيانات العضو غير متاحة. تم الاحتفاظ بمسودة المراجعة.",
                )}
                <Button variant="outline" onClick={() => void person.refetch()}>
                  {l("Retry member", "إعادة تحميل العضو")}
                </Button>
              </div>
            )}
            <h3 className="break-words font-medium">
              {locale === "ar"
                ? snapshot.pv_tasks?.title_ar || snapshot.pv_tasks?.title_en
                : snapshot.pv_tasks?.title_en}
            </h3>
            <p className="text-sm">
              <bdi>{snapshot.pv_tasks?.points ?? "—"} PV</bdi> ·{" "}
              {snapshot.status === "approved"
                ? t("approved")
                : snapshot.status === "rejected"
                  ? t("rejected")
                  : snapshot.status === "needs_info"
                    ? l("Needs information", "يحتاج معلومات")
                    : t("pending")}
            </p>
            <p className="text-xs text-muted-foreground">
              {l("Cairo time", "توقيت القاهرة")}:{" "}
              <bdi>{adminDate(snapshot.created_at, locale)}</bdi>
            </p>
            <section
              aria-label={l("Member evidence", "دليل العضو")}
              className="space-y-2 rounded-xl border border-border p-4"
            >
              <h3 className="text-sm font-medium">{l("Member evidence", "دليل العضو")}</h3>
              <p className="whitespace-pre-wrap break-words text-sm">
                {snapshot.note || l("No evidence note was submitted.", "لم تُقدم ملاحظة دليل.")}
              </p>
            </section>
            {snapshot.review_note && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">
                  {l("Saved review feedback", "ملاحظات المراجعة المحفوظة")}
                </h3>
                <p className="whitespace-pre-wrap break-words text-sm">{snapshot.review_note}</p>
              </section>
            )}
            {snapshot.reviewed_at && (
              <p className="text-xs text-muted-foreground">
                {l("Reviewed", "تمت المراجعة")}:{" "}
                <bdi>{adminDate(snapshot.reviewed_at, locale)}</bdi>
              </p>
            )}
            {outcome && (
              <p role="status" className="text-sm text-success">
                {l("Decision saved", "تم حفظ القرار")}: {decisionName(outcome.status)}
                {outcome.awarded != null && (
                  <>
                    {" "}
                    · {l("Server award receipt", "إيصال مكافأة الخادم")}:{" "}
                    <bdi>{outcome.awarded} PV</bdi>
                  </>
                )}
              </p>
            )}
            {outcome?.awarded != null && outcome.awarded !== outcome.expected && (
              <p role="status" className="text-sm">
                {l(
                  "The server receipt differs from the preview. Review the task configuration.",
                  "يختلف إيصال الخادم عن المعاينة. راجع إعدادات المهمة.",
                )}
              </p>
            )}
            {query.data && !sameClaim(query.data, snapshot) && (
              <p role="status" className="text-sm">
                {l(
                  "Saved claim details changed. Your draft is retained; reload to review the current state.",
                  "تغيرت تفاصيل الطلب المحفوظة. تم الاحتفاظ بمسودتك؛ أعد التحميل لمراجعة الحالة الحالية.",
                )}
              </p>
            )}
            {self && (
              <p role="status" className="text-sm">
                {l(
                  "You cannot review your own claim. Another active administrator must decide it.",
                  "لا يمكنك مراجعة طلبك. يجب أن يراجعه مسؤول نشط آخر.",
                )}
              </p>
            )}
            {(!decided || !!pending) && !self && (
              <form onSubmit={prepare} className="space-y-4">
                <label className="block text-sm min-w-0 max-w-full">
                  {l("Decision", "القرار")}
                  <NativeSelect
                    className="mt-2"
                    value={status}
                    disabled={!ready || !!pending || !!review}
                    onChange={(e) => setStatus(e.target.value as Decision)}
                  >
                    <option value="approved">{decisionName("approved")}</option>
                    <option value="needs_info">{decisionName("needs_info")}</option>
                    <option value="rejected">{decisionName("rejected")}</option>
                  </NativeSelect>
                </label>
                <label className="block text-sm">
                  {l("Decision reason", "سبب القرار")}
                  <Textarea
                    aria-label={l("Decision reason", "سبب القرار")}
                    className="mt-1"
                    maxLength={2000}
                    value={note}
                    disabled={!ready || !!pending || !!review}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {l(
                      "Required for rejection or requesting information; optional for approval.",
                      "مطلوب للرفض أو طلب المعلومات؛ اختياري للموافقة.",
                    )}
                  </span>
                </label>
                {pending && (
                  <p role="status" className="text-sm">
                    {l(
                      "The decision may already be saved. Retry this same decision to confirm its outcome.",
                      "قد يكون القرار محفوظاً بالفعل. أعد محاولة القرار نفسه لتأكيد نتيجته.",
                    )}
                  </p>
                )}
                <Button type="submit" disabled={!ready || !!review}>
                  {l("Review decision", "مراجعة القرار")}
                </Button>
              </form>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              variant="outline"
              disabled={!!review || reloading}
              onClick={() => setReload(true)}
            >
              {l("Reload saved claim", "إعادة تحميل الطلب المحفوظ")}
            </Button>
          </>
        )}
      </AdminEditorDrawer>
      <AdminChangeReview review={review} close={() => setReview(null)} />
      <AlertDialog open={reload} onOpenChange={setReload}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {l("Reload and discard this review draft?", "إعادة التحميل وإزالة مسودة المراجعة؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {l(
                "Reload the saved claim and replace the draft. An unresolved dispatched decision must be retried first. Failed reads keep the draft.",
                "أعد تحميل الطلب المحفوظ واستبدل المسودة. يجب إعادة محاولة القرار المرسل غير المحسوم أولاً. تبقى المسودة عند فشل التحميل.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{l("Keep editing", "متابعة التعديل")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void reloadClaim()}>
              {l("Discard and reload claim", "إزالة المسودة وإعادة تحميل الطلب")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
