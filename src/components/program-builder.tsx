import { useEffect, useState } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { trainingLabel } from "@/lib/training-labels";
import { AdminPersonPicker } from "./admin-person-picker";
import { AdminEditorDrawer } from "./admin-editor-drawer";
import { AdminChangeReview, type AdminReview } from "./admin-change-review";
import { ProgramAssignments } from "./program-assignments";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { MemberSections } from "./member-sections";
import {
  itemInput,
  loadProgramItems,
  removeProgramItem,
  reviewProgramAction,
  saveProgramItem,
  type EditorExercise,
  type Program,
  type ProgramItem,
} from "@/lib/admin-programs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";

export function ProgramBuilder({
  actor,
  program,
  visible,
  enabled,
  week,
  day,
  onSession,
  exercises,
  onDirty,
}: {
  actor: string;
  program: Program;
  visible: boolean;
  enabled: boolean;
  week: number;
  day: number;
  onSession: (week: number, day: number) => void;
  exercises: Pick<
    UseQueryResult<EditorExercise[], Error>,
    "data" | "error" | "isPending" | "refetch"
  >;
  onDirty: (id: string, value: boolean) => void;
}) {
  const { t, locale } = useI18n(),
    qc = useQueryClient(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [section, setSection] = useState("draft"),
    [review, setReview] = useState<AdminReview | null>(null),
    [message, setMessage] = useState<"copy" | "publish" | "row" | null>(null),
    [picked, setPicked] = useState(""),
    [editors, setEditors] = useState<
      { id: string; original: ProgramItem | null; week: number; day: number; position: number }[]
    >([]),
    [dirty, setDirty] = useState<Record<string, boolean>>({}),
    [version, setVersion] = useState("");
  const key = ["program-items", program.id, actor],
    items = useQuery({
      queryKey: key,
      enabled: enabled && visible,
      retry: false,
      queryFn: ({ signal }) => loadProgramItems(program.id, signal),
    });
  const ready = enabled && !items.error && !exercises.error && !!items.data && !!exercises.data;
  const hasDrafts = Object.values(dirty).some(Boolean);
  useEffect(() => onDirty("rows", hasDrafts || !!review), [hasDrafts, review, onDirty]);
  const name = (id: string) => {
    const ex = exercises.data?.find((e) => e.id === id);
    return (
      (locale === "ar" ? ex?.name_ar || ex?.name_en : ex?.name_en) ||
      l("Exercise unavailable", "التمرين غير متاح")
    );
  };
  const session = (items.data ?? [])
    .filter((i) => i.week === week && i.day === day)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  function edit(row: ProgramItem | null) {
    const previous = !row
      ? editors.find((e) => !e.original && e.week === week && e.day === day)
      : editors.find((e) => e.id === row.id);
    if (previous) {
      setPicked(previous.id);
      return;
    }
    const id = row?.id ?? crypto.randomUUID();
    setEditors((old) => [
      ...old,
      {
        id,
        original: row,
        week: row?.week ?? week,
        day: row?.day ?? day,
        position: row?.position ?? Math.max(-1, ...session.map((i) => i.position)) + 1,
      },
    ]);
    setPicked(id);
  }
  function changed(row: ProgramItem) {
    qc.setQueryData<ProgramItem[]>(key, (old) => [
      row,
      ...(old ?? []).filter((i) => i.id !== row.id),
    ]);
    void qc.invalidateQueries({ queryKey: key });
    setPicked("");
    setMessage("row");
  }
  function prepare(action: "copy" | "publish") {
    if (!ready || hasDrafts) return;
    const source = items.data!.filter((i) => i.week === 1),
      replaced = items.data!.filter((i) => i.week > 1);
    setReview({
      title:
        action === "copy"
          ? l("Review week-one copy", "مراجعة نسخ الأسبوع الأول")
          : l("Review program publication", "مراجعة نشر البرنامج"),
      description: program.name,
      details: (
        <div className="space-y-3 text-sm">
          {action === "copy" ? (
            <>
              <p>
                {source.length} {l("week-one rows", "تمريناً في الأسبوع الأول")} →{" "}
                {program.weeks - 1} {l("later weeks", "أسابيع لاحقة")}
              </p>
              <p>
                {l(
                  "This replaces all saved rows in later draft weeks",
                  "يستبدل كل التمارين المحفوظة في الأسابيع اللاحقة للمسودة",
                )}
                : {replaced.length} → {source.length * (program.weeks - 1)}
              </p>
            </>
          ) : (
            <p>
              {items.data!.length}{" "}
              {l(
                "saved exercise rows will be frozen in this version. Unchanged publication retries reuse the same version.",
                "تمريناً محفوظاً سيُجمد في هذه النسخة. تستخدم إعادة محاولة نشر المحتوى نفسه النسخة ذاتها.",
              )}
            </p>
          )}
          <p>
            {l(
              "Previously published versions and assigned prescriptions stay unchanged. The server rejects a preview changed by another editor.",
              "تبقى النسخ المنشورة والتكليفات السابقة كما هي. يرفض الخادم المعاينة إذا غيّرها محرر آخر.",
            )}
          </p>
          <details>
            <summary>{l("Review saved sessions", "مراجعة الجلسات المحفوظة")}</summary>
            <ul className="space-y-2">
              {(action === "copy" ? source : items.data!).map((i) => (
                <li key={i.id} className="break-words">
                  {t("week")} {i.week} · {t("day")} {i.day} · {name(i.exercise_id)} ·{" "}
                  {i.target_sets} × {i.target_reps}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ),
      save: async () => {
        const receipt = await reviewProgramAction(
          actor,
          program,
          items.data!,
          exercises.data!,
          action,
        );
        setMessage(action);
        if (receipt.version_id) {
          setVersion(receipt.version_id);
          setSection("assignments");
          void qc.invalidateQueries({ queryKey: ["program-versions", program.id] });
        }
        await qc.invalidateQueries({ queryKey: key });
      },
    });
  }
  return (
    <section
      className="mt-7 space-y-5 rounded-xl border border-gold/30 bg-card p-4 sm:p-6"
      aria-label={l("Program builder", "محرر البرنامج")}
    >
      <h2 className="break-words font-display text-xl">{program.name}</h2>
      <p className="text-xs text-muted-foreground">
        {l(
          "Editable draft; published versions are immutable snapshots.",
          "مسودة قابلة للتعديل؛ النسخ المنشورة لقطات محفوظة لا تتغير.",
        )}
      </p>
      <MemberSections
        label={l("Program workspace", "مساحة البرنامج")}
        value={section}
        items={[
          ["draft", l("Session builder", "محرر الجلسات")],
          ["assignments", l("Versions & assignments", "النسخ والتعيينات")],
        ]}
        onSelect={setSection}
      />
      {message && (
        <p role="status" className="text-sm text-success">
          {message === "copy"
            ? l(
                "Week one copied to later draft weeks.",
                "تم نسخ الأسبوع الأول إلى الأسابيع اللاحقة.",
              )
            : message === "publish"
              ? l("Frozen version published.", "تم نشر النسخة المجمدة.")
              : l("Exercise row saved.", "تم حفظ التمرين.")}
        </p>
      )}
      {items.isPending && visible && (
        <p role="status">{l("Loading saved sessions…", "جارٍ تحميل الجلسات المحفوظة…")}</p>
      )}
      {exercises.isPending && visible && (
        <p role="status">{l("Loading exercise library…", "جارٍ تحميل مكتبة التمارين…")}</p>
      )}
      {items.error && (
        <div role="alert">
          {items.error.message}
          <Button variant="outline" onClick={() => void items.refetch()}>
            {l("Retry sessions", "إعادة تحميل الجلسات")}
          </Button>
        </div>
      )}
      {exercises.error && (
        <div role="alert">
          {exercises.error.message}
          <Button variant="outline" onClick={() => void exercises.refetch()}>
            {l("Retry exercise library", "إعادة تحميل التمارين")}
          </Button>
        </div>
      )}
      <div hidden={section !== "draft"} className="space-y-5">
        <div className="flex flex-wrap gap-4">
          {(
            [
              [t("week"), week, program.weeks, (n: number) => onSession(n, day)],
              [t("day"), day, 7, (n: number) => onSession(week, n)],
            ] as const
          ).map(([label, value, max, set]) => (
            <label key={label} className="text-sm">
              {label}
              <select
                className="mt-1 block min-h-11 rounded-md border border-input bg-background px-3"
                value={value}
                onChange={(e) => set(Number(e.target.value))}
              >
                {Array.from({ length: max }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {label} {i + 1}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <h3 className="font-medium">
          {t("week")} {week} · {t("day")} {day}
        </h3>
        <Button disabled={!ready} onClick={() => edit(null)}>
          {l("Add exercise to session", "إضافة تمرين للجلسة")}
        </Button>
        {ready && !session.length && (
          <p role="status" className="text-sm text-muted-foreground">
            {l(
              "This session is empty. Add an exercise or leave it as a rest day.",
              "هذه الجلسة فارغة. أضف تمريناً أو اتركها يوم راحة.",
            )}
          </p>
        )}
        <ul className="space-y-3">
          {session.map((i) => (
            <li key={i.id} className="space-y-3 rounded-xl border border-border p-4">
              <p className="break-words font-medium">{name(i.exercise_id)}</p>
              <p className="text-sm text-muted-foreground">
                <bdi>
                  {i.target_sets} × {i.target_reps}
                </bdi>{" "}
                · {l("Order", "الترتيب")} {i.position + 1}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!ready} onClick={() => edit(i)}>
                  {l("Edit exercise row", "تعديل التمرين")}
                </Button>
                <Button
                  variant="ghost"
                  disabled={!ready || !!review}
                  onClick={() =>
                    setReview({
                      title: l("Review exercise removal", "مراجعة إزالة التمرين"),
                      description: name(i.exercise_id),
                      details: (
                        <p>
                          {program.name} · {t("week")} {i.week} · {t("day")} {i.day} ·{" "}
                          {l(
                            "Remove this draft slot only; frozen versions remain saved.",
                            "إزالة موضع المسودة فقط؛ تبقى النسخ المجمدة محفوظة.",
                          )}
                        </p>
                      ),
                      save: async () => {
                        await removeProgramItem(actor, i);
                        await qc.invalidateQueries({ queryKey: key });
                      },
                    })
                  }
                >
                  {l("Remove row", "إزالة التمرين")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {hasDrafts && (
          <p role="status" className="text-sm">
            {l(
              "Save or discard row drafts before copying or publishing.",
              "احفظ مسودات التمارين أو أزلها قبل النسخ أو النشر.",
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {editors
            .filter((e) => dirty[e.id])
            .map((e) => (
              <Button
                key={e.id}
                variant="outline"
                onClick={() => {
                  onSession(e.week, e.day);
                  setPicked(e.id);
                }}
              >
                {l("Resume row draft", "متابعة مسودة تمرين")}: {e.week}/{e.day}
              </Button>
            ))}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <Button
            variant="outline"
            disabled={
              !ready ||
              hasDrafts ||
              program.weeks < 2 ||
              !items.data?.some((i) => i.week === 1) ||
              !!review
            }
            onClick={() => prepare("copy")}
          >
            {l("Review week-one copy", "مراجعة نسخ الأسبوع الأول")}
          </Button>
          <Button
            disabled={!ready || hasDrafts || !items.data?.length || !!review}
            onClick={() => prepare("publish")}
          >
            {l("Review publication", "مراجعة النشر")}
          </Button>
        </div>
      </div>
      <div hidden={section !== "assignments"}>
        <ProgramAssignments
          actor={actor}
          program={program}
          enabled={enabled && visible && section === "assignments"}
          selectedVersion={version}
          onDirty={(value) => onDirty("assignment", value)}
        />
      </div>
      {editors.map((e) => (
        <ProgramRowEditor
          key={e.id}
          actor={actor}
          program={program}
          seed={e}
          exercises={exercises.data ?? []}
          open={picked === e.id && visible}
          enabled={ready}
          close={() => setPicked("")}
          onDirty={(value) =>
            setDirty((old) => (old[e.id] === value ? old : { ...old, [e.id]: value }))
          }
          onSaved={(row) => {
            setDirty((old) => ({ ...old, [e.id]: false }));
            changed(row);
            if (!e.original) setEditors((old) => old.filter((x) => x.id !== e.id));
          }}
        />
      ))}
      <AdminChangeReview review={review} close={() => setReview(null)} />
    </section>
  );
}
function ProgramRowEditor({
  actor,
  program,
  seed,
  exercises,
  open,
  enabled,
  close,
  onDirty,
  onSaved,
}: {
  actor: string;
  program: Program;
  seed: { id: string; original: ProgramItem | null; week: number; day: number; position: number };
  exercises: EditorExercise[];
  open: boolean;
  enabled: boolean;
  close: () => void;
  onDirty: (value: boolean) => void;
  onSaved: (row: ProgramItem) => void;
}) {
  const { locale } = useI18n(),
    qc = useQueryClient(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [original, setOriginal] = useState(seed.original),
    [f, setF] = useState(() => ({
      exercise_id: seed.original?.exercise_id ?? "",
      target_sets: String(seed.original?.target_sets ?? 3),
      target_reps: seed.original?.target_reps ?? "8-12",
      position: String(seed.position + 1),
    })),
    [review, setReview] = useState<AdminReview | null>(null),
    [error, setError] = useState(""),
    [discard, setDiscard] = useState(false),
    [refreshing, setRefreshing] = useState(false);
  const base = {
      exercise_id: original?.exercise_id ?? "",
      target_sets: String(original?.target_sets ?? 3),
      target_reps: original?.target_reps ?? "8-12",
      position: String((original?.position ?? seed.position) + 1),
    },
    dirty = JSON.stringify(f) !== JSON.stringify(base);
  useEffect(() => onDirty(dirty || !!review), [dirty, review, onDirty]);
  const chosen = exercises.find((e) => e.id === f.exercise_id);
  async function discardRow() {
    setError("");
    if (!original) {
      setF(base);
      return;
    }
    setRefreshing(true);
    try {
      const rows = await loadProgramItems(program.id);
      const row = rows.find((row) => row.id === original.id);
      if (!row)
        throw new Error(
          l(
            "This saved row no longer exists. Close the editor and reload the program.",
            "هذا التمرين المحفوظ لم يعد موجوداً. أغلق المحرر وأعد تحميل البرنامج.",
          ),
        );
      setOriginal(row);
      qc.setQueryData(["program-items", program.id, actor], rows);
      setF({
        exercise_id: row.exercise_id,
        target_sets: String(row.target_sets),
        target_reps: row.target_reps,
        position: String(row.position + 1),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  function prepare() {
    setError("");
    try {
      const values = itemInput(f, seed.week, seed.day, program.weeks);
      setReview({
        title: l("Review session exercise", "مراجعة تمرين الجلسة"),
        description: `${program.name} · ${seed.week}/${seed.day}`,
        details: (
          <div className="space-y-3 text-sm">
            <p>{chosen?.name_en ?? "—"}</p>
            <p>
              <bdi>
                {values.target_sets} × {values.target_reps}
              </bdi>{" "}
              · {l("Order", "الترتيب")} {values.position + 1}
            </p>
            <p>
              {l(
                "Only this editable draft slot changes. Previously assigned versions keep their prescriptions.",
                "يتغير موضع المسودة هذا فقط. تحتفظ النسخ المعينة سابقاً بأهدافها.",
              )}
            </p>
          </div>
        ),
        save: async () => {
          const row = await saveProgramItem(actor, seed.id, program, values, original);
          setOriginal(row);
          setF({
            exercise_id: row.exercise_id,
            target_sets: String(row.target_sets),
            target_reps: row.target_reps,
            position: String(row.position + 1),
          });
          onSaved(row);
        },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <AdminEditorDrawer
        open={open}
        close={close}
        locked={!!review || refreshing}
        title={
          original
            ? l("Edit session exercise", "تعديل تمرين الجلسة")
            : l("Add session exercise", "إضافة تمرين للجلسة")
        }
        description={`${program.name} · ${seed.week}/${seed.day}`}
      >
        <AdminPersonPicker
          label={l("Exercise", "التمرين")}
          emptyLabel={l("Choose an exercise", "اختر تمريناً")}
          people={exercises
            .filter((e) => e.active || e.id === original?.exercise_id)
            .map((e) => ({
              id: e.id,
              display_name:
                (locale === "ar" ? e.name_ar || e.name_en : e.name_en) +
                (e.active ? "" : ` (${l("archived", "مؤرشف")})`),
              email: `${e.muscle} · ${e.equipment ?? ""}`,
            }))}
          value={f.exercise_id}
          onChange={(id) => setF({ ...f, exercise_id: id })}
          disabled={!enabled || !!review || refreshing}
        />
        {chosen && (
          <p className="text-xs text-muted-foreground">
            {trainingLabel(chosen.logging_mode || "weighted_reps", locale)} ·{" "}
            {trainingLabel(chosen.load_convention || "external_total", locale)}
          </p>
        )}
        {(
          [
            ["target_sets", l("Working sets", "مجموعات العمل")],
            ["target_reps", l("Reps / time target", "هدف التكرارات أو الوقت")],
            ["position", l("Order", "الترتيب")],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            {label}
            <Input
              className="mt-1"
              inputMode={key === "target_reps" ? undefined : "numeric"}
              maxLength={key === "target_reps" ? 64 : 12}
              disabled={!enabled || !!review || refreshing}
              value={f[key]}
              onChange={(e) => setF({ ...f, [key]: e.target.value })}
            />
          </label>
        ))}
        <p className="text-xs text-muted-foreground">
          {l(
            "For timed exercises include a unit, for example 30s. These are prescriptions, not completed sets or enabled progression rules.",
            "للتمارين الزمنية أضف الوحدة مثل 30s. هذه أهداف وليست مجموعات مكتملة أو قواعد تقدم مفعلة.",
          )}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!enabled || !!review || refreshing || !dirty} onClick={prepare}>
            {l("Review session exercise", "مراجعة تمرين الجلسة")}
          </Button>
          <Button
            variant="outline"
            disabled={!!review || refreshing}
            onClick={() => setDiscard(true)}
          >
            {l("Discard row draft", "إزالة مسودة التمرين")}
          </Button>
        </div>
      </AdminEditorDrawer>
      <AdminChangeReview review={review} close={() => setReview(null)} />
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {l("Discard this row draft?", "إزالة مسودة هذا التمرين؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {l(
                "Discard these inputs and reload the latest saved row. If loading fails, your inputs are retained. A new unsaved row resets to its starting targets.",
                "أزل هذه المدخلات وأعد تحميل أحدث تمرين محفوظ. تبقى المدخلات إذا فشل التحميل. يعود التمرين الجديد غير المحفوظ لأهداف البداية.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{l("Keep editing", "متابعة التعديل")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void discardRow()}>
              {l("Discard row changes", "إزالة تغييرات التمرين")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
