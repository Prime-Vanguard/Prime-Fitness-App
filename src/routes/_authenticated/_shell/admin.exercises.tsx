import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { normalizeExercise } from "@/lib/exercise-guidance";
import { loadEditorExercises, type EditorExercise } from "@/lib/admin-programs";
import { createExercise, setExerciseActive, loadExerciseCoverage } from "@/lib/admin-exercises";
import { PageHeader } from "@/components/page-header";
import { AdminEditorDrawer, AdminDraftWarning } from "@/components/admin-editor-drawer";
import { AdminChangeReview, type AdminReview } from "@/components/admin-change-review";
import { ExerciseEditor } from "@/components/exercise-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/_shell/admin/exercises")({
  head: () => ({
    meta: [
      { title: "Exercise library — Prime Fitness Admin" },
      { name: "description", content: "Manage the Prime Fitness exercise library." },
      { property: "og:title", content: "Exercise library — Prime Fitness Admin" },
      { property: "og:description", content: "Manage the Prime Fitness exercise library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Exercises,
});

function Exercises() {
  const { user } = Route.useRouteContext(),
    { data: me } = useMe(user.id),
    { t, locale } = useI18n(),
    qc = useQueryClient(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const allowed = !!me?.isAdmin && !!me.profile?.access_active,
    key = ["admin-exercises", user.id];
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("active"),
    [editorial, setEditorial] = useState("all"),
    [muscle, setMuscle] = useState(""),
    [page, setPage] = useState(1),
    [open, setOpen] = useState(""),
    [visited, setVisited] = useState<EditorExercise[]>([]),
    [createOpen, setCreateOpen] = useState(false),
    [dirty, setDirty] = useState<Record<string, boolean>>({}),
    [review, setReview] = useState<AdminReview | null>(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState(() => ({
      id: crypto.randomUUID(),
      name_en: "",
      name_ar: "",
      muscle: "",
      equipment: "",
    })),
    [pending, setPending] = useState<typeof draft | null>(null);
  const reportDirty = useCallback(
    (id: string, value: boolean) =>
      setDirty((old) => (old[id] === value ? old : { ...old, [id]: value })),
    [],
  );
  const data = useQuery({
    queryKey: key,
    enabled: allowed,
    retry: false,
    queryFn: ({ signal }) => loadEditorExercises(signal),
  });
  const coverage = useQuery({
    queryKey: ["exercise-editor-coverage", user.id],
    enabled: allowed,
    retry: false,
    queryFn: ({ signal }) => loadExerciseCoverage(signal),
  });
  const rows = (data.data ?? []).filter(
    (e) =>
      normalizeExercise(`${e.name_en} ${e.name_ar ?? ""} ${e.aliases?.join(" ") ?? ""}`).includes(
        normalizeExercise(q),
      ) &&
      (status === "all" || e.active === (status === "active")) &&
      (!muscle || e.muscle === muscle) &&
      (editorial === "all" ||
        (editorial === "required" &&
          coverage.data?.has(e.id) &&
          e.editorial_status !== "reviewed") ||
        editorial === e.editorial_status),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    shown = Math.min(page, pages);
  function accepted(row: EditorExercise) {
    qc.setQueryData<EditorExercise[]>(key, (old) => [
      row,
      ...(old ?? []).filter((e) => e.id !== row.id),
    ]);
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["exercises"] });
    void qc.invalidateQueries({ queryKey: ["program-editor-exercises"] });
    setSaved(true);
  }
  function edit(row: EditorExercise) {
    setVisited((old) => (old.some((e) => e.id === row.id) ? old : [...old, row]));
    setOpen(row.id);
  }
  function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!draft.name_en.trim() || !draft.muscle.trim()) {
      setError(
        l("Enter the English name and primary muscle.", "أدخل الاسم بالإنجليزية والعضلة الرئيسية."),
      );
      return;
    }
    const request = pending ?? draft;
    setReview({
      title: l("Review new exercise", "مراجعة تمرين جديد"),
      description: request.name_en,
      details: (
        <p>
          {request.muscle} · {request.equipment || l("Equipment not set", "الأداة غير محددة")} ·{" "}
          {l(
            "Starts as needs review; complete its guidance and classification before approval.",
            "يبدأ بحالة يحتاج مراجعة؛ أكمل الشرح والتصنيف قبل الاعتماد.",
          )}
        </p>
      ),
      save: async () => {
        const row = await createExercise(user.id, request.id, request, () => setPending(request));
        accepted(row);
        setPending(null);
        setDraft({ id: crypto.randomUUID(), name_en: "", name_ar: "", muscle: "", equipment: "" });
        setCreateOpen(false);
        edit(row);
      },
    });
  }
  if (me && !allowed) return <p className="mt-10">{t("notAllowed")}</p>;
  return (
    <>
      <PageHeader eyebrow={t("admin")} title={t("exercises")} />
      <p className="mt-3 text-sm text-muted-foreground">
        {l(
          "Search the catalogue, review editorial gaps and edit one exercise at a time.",
          "ابحث في المكتبة وراجع الحقول غير المكتملة وعدّل تمريناً واحداً في كل مرة.",
        )}
      </p>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="w-full max-w-sm text-sm">
          {l("Search exercises", "بحث التمارين")}
          <Input
            className="mt-1"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <Button
          disabled={!allowed || !!data.error || data.isPending}
          onClick={() => setCreateOpen(true)}
        >
          {l("Create exercise", "إنشاء تمرين")}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {(
          [
            [
              l("Exercise visibility", "ظهور التمرين"),
              status,
              setStatus,
              [
                ["active", l("Active", "نشط")],
                ["archived", l("Archived", "مؤرشف")],
                ["all", l("All", "الكل")],
              ],
            ],
            [
              l("Editorial filter", "تصفية المراجعة"),
              editorial,
              setEditorial,
              [
                ["all", l("All", "الكل")],
                ["reviewed", l("Reviewed", "تمت المراجعة")],
                ["needs_review", l("Needs review", "يحتاج مراجعة")],
                ["required", l("Active-program exceptions", "نواقص البرامج النشطة")],
              ],
            ],
          ] as const
        ).map(([label, value, set, options]) => (
          <label key={label} className="text-sm">
            {label}
            <select
              className="mt-1 block min-h-11 max-w-full rounded-md border border-input bg-background px-3"
              value={value}
              onChange={(e) => {
                set(e.target.value);
                if (e.target.value === "required") setStatus("all");
                setPage(1);
              }}
            >
              {options.map(([v, name]) => (
                <option
                  key={v}
                  value={v}
                  disabled={v === "required" && (!coverage.data || !!coverage.error)}
                >
                  {name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="text-sm">
          {l("Muscle filter", "تصفية العضلة")}
          <select
            className="mt-1 block min-h-11 rounded-md border border-input bg-background px-3"
            value={muscle}
            onChange={(e) => {
              setMuscle(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{l("All muscles", "كل العضلات")}</option>
            {[...new Set(data.data?.map((e) => e.muscle))].sort().map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      {data.isPending && (
        <p role="status" className="mt-4">
          {l("Loading catalogue…", "جارٍ تحميل المكتبة…")}
        </p>
      )}
      {data.error && (
        <div role="alert" className="mt-4">
          {l(
            "The complete catalogue could not be loaded. Changes are paused.",
            "تعذر تحميل المكتبة كاملة. تم إيقاف التعديلات.",
          )}
          <Button variant="outline" onClick={() => void data.refetch()}>
            {l("Retry catalogue", "إعادة تحميل المكتبة")}
          </Button>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        {l("Active-program exercise coverage", "تغطية تمارين البرامج النشطة")}:{" "}
        {coverage.data?.size ?? "—"} · {l("Editorial exceptions", "نواقص المراجعة")}:{" "}
        {coverage.data && data.data
          ? data.data.filter((e) => coverage.data.has(e.id) && e.editorial_status !== "reviewed")
              .length
          : "—"}
      </p>
      {coverage.error && (
        <div role="alert" className="text-sm">
          {l("Coverage is unavailable; it is not zero.", "تغطية البرامج غير متاحة وليست صفراً.")}
          <Button variant="ghost" onClick={() => void coverage.refetch()}>
            {l("Retry coverage", "إعادة تحميل التغطية")}
          </Button>
        </div>
      )}
      {saved && (
        <p role="status" className="mt-4 text-sm text-success">
          {l("Catalogue changes saved.", "تم حفظ تغييرات المكتبة.")}
        </p>
      )}
      {!data.isPending && !data.error && !rows.length && (
        <p role="status" className="mt-5">
          {l("No exercises match these filters.", "لا توجد تمارين تطابق هذه التصفية.")}
        </p>
      )}
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {rows.slice((shown - 1) * 25, shown * 25).map((e) => (
          <li key={e.id} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="break-words font-medium">
              {locale === "ar" ? e.name_ar || e.name_en : e.name_en}
            </p>
            <p className="break-words text-sm text-muted-foreground">
              {e.muscle} · {e.equipment || "—"} ·{" "}
              {e.editorial_status === "reviewed"
                ? l("Reviewed", "تمت المراجعة")
                : l("Needs review", "يحتاج مراجعة")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!!data.error} onClick={() => edit(e)}>
                {l("Edit exercise", "تعديل التمرين")}
              </Button>
              <Button
                variant="ghost"
                disabled={!!data.error || !!review}
                onClick={() =>
                  setReview({
                    title: l("Review exercise visibility", "مراجعة ظهور التمرين"),
                    description: e.name_en,
                    details: (
                      <p>
                        {e.active
                          ? l(
                              "Archive from new-exercise selection. Historical records and frozen programs retain their saved exercise data.",
                              "أرشف التمرين من الاختيارات الجديدة. تبقى بياناته في السجلات والبرامج المجمدة محفوظة.",
                            )
                          : l(
                              "Restore to new-exercise selection.",
                              "إعادة التمرين للاختيارات الجديدة.",
                            )}
                      </p>
                    ),
                    save: async () => accepted(await setExerciseActive(user.id, e, !e.active)),
                  })
                }
              >
                {e.active ? l("Archive", "أرشفة") : l("Restore", "استعادة")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav
          className="mt-5 flex items-center justify-between gap-3"
          aria-label={l("Exercise pages", "صفحات التمارين")}
        >
          <Button variant="outline" disabled={shown === 1} onClick={() => setPage(shown - 1)}>
            {l("Previous exercises", "التمارين السابقة")}
          </Button>
          <span>
            <bdi>
              {shown} / {pages}
            </bdi>
          </span>
          <Button variant="outline" disabled={shown === pages} onClick={() => setPage(shown + 1)}>
            {l("Next exercises", "التمارين التالية")}
          </Button>
        </nav>
      )}
      {visited.map((row) => (
        <ExerciseEditor
          key={row.id}
          userId={user.id}
          exercise={data.data?.find((e) => e.id === row.id) ?? row}
          catalogue={data.data ?? []}
          open={open === row.id}
          close={() => setOpen("")}
          enabled={allowed && !data.error}
          onDirty={reportDirty}
          onSaved={accepted}
        />
      ))}
      <AdminEditorDrawer
        open={createOpen}
        close={() => setCreateOpen(false)}
        locked={!!review}
        title={l("Create exercise", "إنشاء تمرين")}
        description={l(
          "Add a stable catalogue identity, then complete its classification and guidance.",
          "أضف هوية ثابتة للمكتبة ثم أكمل التصنيف والشرح.",
        )}
      >
        <form onSubmit={create} className="space-y-4">
          {(
            [
              ["name_en", l("Name (English)", "الاسم بالإنجليزية")],
              ["name_ar", l("Name (Arabic)", "الاسم بالعربية")],
              ["muscle", l("Primary muscle", "العضلة الرئيسية")],
              ["equipment", l("Equipment label", "اسم الأداة")],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="block text-sm">
              {label}
              <Input
                className="mt-1"
                required={k === "name_en" || k === "muscle"}
                disabled={!!pending || !!review}
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            </label>
          ))}
          {pending && (
            <p role="status" className="text-sm">
              {l(
                "Retry this same creation request to resolve its outcome.",
                "أعد محاولة طلب الإنشاء نفسه لتأكيد نتيجته.",
              )}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <Button type="submit" disabled={!!review || !allowed || !!data.error}>
            {l("Review new exercise", "مراجعة تمرين جديد")}
          </Button>
        </form>
      </AdminEditorDrawer>
      <AdminChangeReview review={review} close={() => setReview(null)} />
      <AdminDraftWarning
        dirty={
          allowed &&
          (Object.values(dirty).some(Boolean) ||
            !!draft.name_en ||
            !!draft.name_ar ||
            !!draft.muscle ||
            !!draft.equipment ||
            !!review)
        }
      />
    </>
  );
}
