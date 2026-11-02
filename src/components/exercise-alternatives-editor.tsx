import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import type { EditorExercise } from "@/lib/admin-programs";
import {
  loadAlternatives,
  saveAlternative,
  deleteAlternative,
  type Alternative,
} from "@/lib/admin-exercises";
import { AdminPersonPicker } from "./admin-person-picker";
import { AdminChangeReview, type AdminReview } from "./admin-change-review";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
type Draft = { original: Alternative | null; en: string; ar: string };
export function ExerciseAlternativesEditor({
  actor,
  exercise,
  catalogue,
  enabled,
  onDirty,
}: {
  actor: string;
  exercise: EditorExercise;
  catalogue: EditorExercise[];
  enabled: boolean;
  onDirty: (dirty: boolean) => void;
}) {
  const { locale } = useI18n(),
    qc = useQueryClient(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [picked, setPicked] = useState(""),
    [drafts, setDrafts] = useState<Record<string, Draft>>({}),
    [review, setReview] = useState<AdminReview | null>(null),
    [message, setMessage] = useState(false),
    [error, setError] = useState("");
  const key = ["exercise-alternatives-admin", actor, exercise.id];
  const query = useQuery({
    queryKey: key,
    enabled,
    retry: false,
    queryFn: ({ signal }) => loadAlternatives(exercise.id, signal),
  });
  const dirty = Object.values(drafts).some(
    (d) => d.en !== (d.original?.reason_en ?? "") || d.ar !== (d.original?.reason_ar ?? ""),
  );
  useEffect(() => onDirty(dirty || !!review), [dirty, review, onDirty]);
  const name = (id: string) => {
    const e = catalogue.find((x) => x.id === id);
    return (
      (locale === "ar" ? e?.name_ar || e?.name_en : e?.name_en) ||
      l("Exercise unavailable", "التمرين غير متاح")
    );
  };
  const ready = enabled && !!query.data && !query.error;
  function select(id: string) {
    setPicked(id);
    if (id)
      setDrafts((old) =>
        old[id]
          ? old
          : {
              ...old,
              [id]: {
                original: query.data?.find((r) => r.alternative_id === id) ?? null,
                en: query.data?.find((r) => r.alternative_id === id)?.reason_en ?? "",
                ar: query.data?.find((r) => r.alternative_id === id)?.reason_ar ?? "",
              },
            },
      );
  }
  function refresh() {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["exercise-alternatives", exercise.id] });
  }
  function prepare() {
    const draft = drafts[picked];
    if (!draft) return;
    setError("");
    if (!draft.en.trim() || !draft.ar.trim()) {
      setError(l("Add an English and Arabic explanation.", "أضف شرحاً بالإنجليزية والعربية."));
      return;
    }
    setReview({
      title: l("Review alternative", "مراجعة البديل"),
      description: `${exercise.name_en} → ${name(picked)}`,
      details: (
        <div className="space-y-3 text-sm">
          <p className="break-words">{draft.en}</p>
          <p dir="rtl" className="break-words">
            {draft.ar}
          </p>
          <p>
            {l(
              "This approves a directional alternative, without transferring a strength baseline or changing a live workout.",
              "يعتمد هذا بديلاً لهذا التمرين دون نقل مستوى القوة أو تغيير تدريب جارٍ.",
            )}
          </p>
        </div>
      ),
      save: async () => {
        const row = await saveAlternative(actor, exercise.id, picked, draft, draft.original);
        setDrafts((old) => ({
          ...old,
          [row.alternative_id]: { original: row, en: row.reason_en, ar: row.reason_ar },
        }));
        refresh();
        setMessage(true);
      },
    });
  }
  return (
    <section className="space-y-4" aria-label={l("Approved alternatives", "البدائل المعتمدة")}>
      <p className="text-sm text-muted-foreground">
        {l(
          "Alternatives are approved explicitly for this exercise. Explain equipment differences in both languages.",
          "تُعتمد البدائل صراحةً لهذا التمرين. وضح اختلاف الأدوات باللغتين.",
        )}
      </p>
      {query.isPending && <p role="status">{l("Loading alternatives…", "جارٍ تحميل البدائل…")}</p>}
      {query.error && (
        <div role="alert">
          {query.error.message}
          <Button variant="outline" onClick={() => void query.refetch()}>
            {l("Retry alternatives", "إعادة تحميل البدائل")}
          </Button>
        </div>
      )}
      <AdminPersonPicker
        label={l("Alternative exercise", "التمرين البديل")}
        people={catalogue
          .filter(
            (e) =>
              e.id !== exercise.id &&
              (e.active || e.id === picked || query.data?.some((r) => r.alternative_id === e.id)),
          )
          .map((e) => ({ id: e.id, display_name: name(e.id), email: e.equipment }))}
        value={picked}
        onChange={select}
        disabled={!ready || !!review}
        emptyLabel={l("Choose an alternative", "اختر بديلاً")}
      />
      {picked && drafts[picked] && (
        <>
          <label className="block text-sm">
            {l("Equipment explanation in English", "سبب البديل والأدوات بالإنجليزية")}
            <Input
              className="mt-1"
              maxLength={2000}
              disabled={!ready || !!review}
              value={drafts[picked].en}
              onChange={(e) =>
                setDrafts((old) => ({ ...old, [picked]: { ...old[picked]!, en: e.target.value } }))
              }
            />
          </label>
          <label className="block text-sm">
            {l("Arabic explanation", "الشرح بالعربية")}
            <Input
              className="mt-1"
              dir="rtl"
              maxLength={2000}
              disabled={!ready || !!review}
              value={drafts[picked].ar}
              onChange={(e) =>
                setDrafts((old) => ({ ...old, [picked]: { ...old[picked]!, ar: e.target.value } }))
              }
            />
          </label>
          <Button disabled={!ready || !!review} onClick={prepare}>
            {l("Review alternative", "مراجعة البديل")}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-success">
          {l("Alternative changes saved.", "تم حفظ تغييرات البديل.")}
        </p>
      )}
      <ul className="divide-y divide-border">
        {query.data?.map((row) => (
          <li key={row.alternative_id} className="space-y-2 py-3">
            <p className="break-words text-sm font-medium">{name(row.alternative_id)}</p>
            <p className="break-words text-xs text-muted-foreground">
              {locale === "ar" ? row.reason_ar : row.reason_en}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!ready || !!review}
                onClick={() => select(row.alternative_id)}
              >
                {l("Edit explanation", "تعديل الشرح")}
              </Button>
              <Button
                variant="ghost"
                disabled={!ready || !!review}
                onClick={() =>
                  setReview({
                    title: l("Remove approved alternative", "إزالة البديل المعتمد"),
                    description: name(row.alternative_id),
                    details: (
                      <p>
                        {l(
                          "Remove this alternative relationship only. Historical workouts and the exercise catalogue entry remain saved.",
                          "تزيل هذه العملية علاقة البديل فقط. تبقى سجلات التدريب والتمرين في المكتبة محفوظة.",
                        )}
                      </p>
                    ),
                    save: async () => {
                      await deleteAlternative(actor, row);
                      setDrafts((old) => {
                        const next = { ...old };
                        delete next[row.alternative_id];
                        return next;
                      });
                      if (picked === row.alternative_id) setPicked("");
                      refresh();
                      setMessage(true);
                    },
                  })
                }
              >
                {l("Remove alternative", "إزالة البديل")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <AdminChangeReview review={review} close={() => setReview(null)} />
    </section>
  );
}
