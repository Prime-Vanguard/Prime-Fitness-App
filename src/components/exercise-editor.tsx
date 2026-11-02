import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { trainingLabel } from "@/lib/training-labels";
import {
  exerciseForm,
  exerciseIssues,
  exercisePayload,
  saveExercise,
  textSourceFor,
  type ExerciseForm,
} from "@/lib/admin-exercises";
import type { EditorExercise } from "@/lib/admin-programs";
import { referenceEquipment, referenceSource } from "@/lib/exercise-reference";
import { AdminEditorDrawer } from "./admin-editor-drawer";
import { AdminChangeReview, type AdminReview } from "./admin-change-review";
import { MemberSections } from "./member-sections";
import { ExerciseReferencePicker } from "./exercise-reference-picker";
import { ExerciseAlternativesEditor } from "./exercise-alternatives-editor";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";

export function ExerciseEditor({
  userId,
  exercise,
  open,
  close,
  enabled,
  catalogue,
  onDirty,
  onSaved,
}: {
  userId: string;
  exercise: EditorExercise;
  open: boolean;
  close: () => void;
  enabled: boolean;
  catalogue: EditorExercise[];
  onDirty: (id: string, dirty: boolean) => void;
  onSaved: (row: EditorExercise) => void;
}) {
  const { locale } = useI18n(),
    qc = useQueryClient(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [original, setOriginal] = useState(exercise),
    [f, setF] = useState(() => exerciseForm(exercise)),
    [source, setSource] = useState(() => textSourceFor(exercise)),
    [section, setSection] = useState("identity"),
    [review, setReview] = useState<AdminReview | null>(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [reload, setReload] = useState(false),
    [reloading, setReloading] = useState(false),
    [altDirty, setAltDirty] = useState(false);
  const dirty =
    JSON.stringify(f) !== JSON.stringify(exerciseForm(original)) ||
    JSON.stringify(source) !== JSON.stringify(textSourceFor(original));
  useEffect(() => {
    onDirty(exercise.id, dirty || altDirty || !!review);
  }, [dirty, altDirty, review, exercise.id, onDirty]);
  const issues = exerciseIssues(f),
    locked = !!review || !enabled || reloading;
  function patch(key: keyof ExerciseForm, value: string | boolean) {
    setF((old) => ({ ...old, [key]: value, ...(key !== "reviewed" ? { reviewed: false } : {}) }));
    setSaved(false);
    setError("");
  }
  function field(key: keyof ExerciseForm, label: string, multiline = false) {
    return (
      <label key={key} className="block text-sm">
        {label}
        {multiline ? (
          <Textarea
            className="mt-1"
            aria-label={label}
            dir={key.endsWith("_ar") ? "rtl" : undefined}
            maxLength={10000}
            disabled={locked}
            value={String(f[key])}
            onChange={(e) => patch(key, e.target.value)}
          />
        ) : (
          <Input
            className="mt-1"
            aria-label={label}
            dir={key.endsWith("_ar") ? "rtl" : undefined}
            disabled={locked}
            value={String(f[key])}
            onChange={(e) => patch(key, e.target.value)}
          />
        )}
      </label>
    );
  }
  function prepare() {
    setError("");
    try {
      const payload = exercisePayload(original, f, source);
      setReview({
        title: l("Review exercise changes", "مراجعة تغييرات التمرين"),
        description: f.name_en,
        details: (
          <div className="space-y-3 text-sm">
            <p>
              {l("Editorial status", "حالة المراجعة")}:{" "}
              {f.reviewed ? l("Reviewed", "تمت المراجعة") : l("Needs review", "يحتاج مراجعة")}
            </p>
            <p>
              {trainingLabel(f.logging_mode, locale)} · {trainingLabel(f.load_convention, locale)}
            </p>
            <p>
              {l("Equipment", "الأدوات")}: {f.equipment_tags || "—"}
            </p>
            <p>
              {l(
                "Changes affect future catalogue use. Existing frozen versions and workout records retain their saved identity and conventions.",
                "تؤثر التغييرات على استخدام المكتبة مستقبلاً. تحتفظ النسخ المجمدة وسجلات التدريب ببياناتها المحفوظة.",
              )}
            </p>
            <details>
              <summary>{l("Review guidance text", "مراجعة نص الشرح")}</summary>
              <p className="whitespace-pre-wrap break-words">{f.steps_en}</p>
              <p dir="rtl" className="whitespace-pre-wrap break-words">
                {f.steps_ar}
              </p>
            </details>
            {payload.media && (
              <p className="break-all">
                {l("Demonstration", "الشرح المرئي")}: {f.url} · {f.license} · {f.author}
              </p>
            )}
          </div>
        ),
        save: async () => {
          const row = await saveExercise(userId, original, f, source);
          setOriginal(row);
          setF(exerciseForm(row));
          setSource(textSourceFor(row));
          setSaved(true);
          onSaved(row);
          void qc.invalidateQueries({ queryKey: ["exercises"] });
        },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function reloadExercise() {
    setReloading(true);
    try {
      const r = await supabase
        .from("exercises")
        .select("*")
        .eq("id", exercise.id)
        .maybeSingle()
        .retry(false);
      if (r.error) throw r.error;
      if (!r.data) throw new Error("Exercise unavailable. Your draft is retained.");
      setOriginal(r.data);
      setF(exerciseForm(r.data));
      setSource(textSourceFor(r.data));
      setError("");
      setSaved(false);
      onSaved(r.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReloading(false);
    }
  }
  return (
    <>
      <AdminEditorDrawer
        open={open}
        close={close}
        locked={!!review || reloading}
        title={l("Edit exercise", "تعديل التمرين")}
        description={exercise.name_en}
      >
        <MemberSections
          label={l("Exercise editor sections", "أقسام تعديل التمرين")}
          value={section}
          items={[
            ["identity", l("Identity", "الاسم والهوية")],
            ["classification", l("Classification", "التصنيف")],
            ["guidance", l("Guidance", "الشرح")],
            ["media", l("Media rights", "حقوق الوسائط")],
            ["alternatives", l("Alternatives", "البدائل")],
          ]}
          onSelect={setSection}
          disabled={!!review}
        />
        {original.updated_at !== exercise.updated_at && dirty && (
          <p role="status" className="text-sm">
            {l(
              "Saved exercise details changed. Your draft is retained; reload to review the latest record.",
              "تغيرت بيانات التمرين المحفوظة. تم الاحتفاظ بمسودتك؛ أعد التحميل لمراجعة آخر نسخة.",
            )}
          </p>
        )}
        <div hidden={section !== "identity"} className="space-y-4">
          {field("name_en", l("Name (English)", "الاسم بالإنجليزية"))}
          {field("name_ar", l("Name (Arabic)", "الاسم بالعربية"))}
          {field("aliases", l("Aliases, comma separated", "الأسماء البديلة، افصل بفاصلة"))}
          <p className="text-xs text-muted-foreground">
            {l("Stable exercise ID", "معرّف التمرين الثابت")}: <bdi>{exercise.id}</bdi>
          </p>
        </div>
        <div hidden={section !== "classification"} className="space-y-4">
          {field("muscle", l("Primary muscle", "العضلة الرئيسية"))}
          {field("equipment", l("Equipment label", "اسم الأداة"))}
          {field("equipment_tags", l("Equipment tags, comma separated", "الأدوات، افصل بفاصلة"))}
          {field("movement_pattern", l("Movement classification", "تصنيف الحركة"))}
          {(
            [
              [
                "logging_mode",
                l("Logging mode", "نوع التسجيل"),
                ["weighted_reps", "bodyweight_reps", "timed"],
              ],
              [
                "load_convention",
                l("Load convention", "طريقة الوزن"),
                ["external_total", "per_hand", "bodyweight"],
              ],
            ] as const
          ).map(([key, label, options]) => (
            <label key={key} className="block text-sm">
              {label}
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3"
                value={f[key]}
                disabled={locked}
                onChange={(e) => patch(key, e.target.value)}
              >
                {options.map((value) => (
                  <option key={value} value={value}>
                    {trainingLabel(value, locale)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div hidden={section !== "guidance"} className="space-y-4">
          <ExerciseReferencePicker
            exerciseName={original.name_en}
            onChoose={(row) => {
              setF((old) => ({
                ...old,
                steps_en: row.steps_en.join("\n"),
                equipment_tags: referenceEquipment(row.equipment),
                reviewed: false,
              }));
              setSource(referenceSource(row));
              setSaved(false);
            }}
          />
          {source && (
            <p className="text-xs text-muted-foreground">
              {l(
                "English text attribution: Hasan Emir Yıldırım’s MIT exercise dataset. Review the Arabic translation and classification before approval.",
                "إسناد النص الإنجليزي: بيانات تمارين حسن أمير يلدريم بترخيص MIT. راجع الترجمة العربية والتصنيف قبل الاعتماد.",
              )}
            </p>
          )}
          {field(
            "steps_en",
            l("English steps, one per line", "خطوات بالإنجليزية، واحدة لكل سطر"),
            true,
          )}
          {field(
            "steps_ar",
            l("Arabic steps, one per line", "خطوات بالعربية، واحدة لكل سطر"),
            true,
          )}
          {field("cues_en", l("English setup / execution cues", "نصائح الأداء بالإنجليزية"), true)}
          {field("cues_ar", l("Arabic setup / execution cues", "نصائح الأداء بالعربية"), true)}
          {field("mistakes_en", l("English common mistakes", "الأخطاء بالإنجليزية"), true)}
          {field("mistakes_ar", l("Arabic common mistakes", "الأخطاء بالعربية"), true)}
        </div>
        <div hidden={section !== "media"} className="space-y-4">
          <p className="text-sm">
            {l(
              "Member-approved demonstration record. Record ownership and permission before saving. Licensed Gym Visual catalogue delivery and internal reference styling previews remain separate; importing MIT text never approves an image or GIF.",
              "سجل الشرح المرئي المعتمد للأعضاء. سجل الملكية والإذن قبل الحفظ. تبقى مكتبة Gym Visual المرخصة والمعاينات المرجعية منفصلتين؛ استيراد نص MIT لا يعتمد صورة أو رسماً متحركاً.",
            )}
          </p>
          {field("url", l("HTTPS media URL", "رابط الوسائط HTTPS"))}
          {field("author", l("Author", "المؤلف"))}
          {field("source", l("Source", "المصدر"))}
          {field("permission", l("Permission evidence / reference", "إثبات أو مرجع الإذن"))}
          {field("attribution", l("Attribution shown to members", "الإسناد الظاهر للأعضاء"))}
          {field("poster", l("Optional static poster URL", "رابط صورة الغلاف الثابتة الاختيارية"))}
          <label className="block text-sm">
            {l("Media license", "ترخيص الوسائط")}
            <select
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3"
              value={f.license}
              disabled={locked}
              onChange={(e) => patch("license", e.target.value)}
            >
              {["original", "CC0", "CC-BY-4.0"].map((v) => (
                <option key={v} value={v}>
                  {trainingLabel(v, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {l("Media type", "نوع الوسائط")}
            <select
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3"
              value={f.kind}
              disabled={locked}
              onChange={(e) => patch("kind", e.target.value)}
            >
              <option value="">{l("Infer from URL", "استنتاج من الرابط")}</option>
              {["image", "gif", "video"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div hidden={section !== "alternatives"}>
          <ExerciseAlternativesEditor
            actor={userId}
            exercise={exercise}
            catalogue={catalogue}
            enabled={enabled && open && section === "alternatives"}
            onDirty={setAltDirty}
          />
        </div>
        {section !== "alternatives" && (
          <div className="space-y-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {issues.length
                ? l("Outstanding editorial fields", "حقول تحتاج مراجعة") +
                  ": " +
                  issues
                    .map((issue) =>
                      locale === "ar"
                        ? ({
                            "English instructions": "الشرح بالإنجليزية",
                            "Arabic instructions": "الشرح بالعربية",
                            "Equipment classification": "تصنيف الأدوات",
                            "Movement classification": "تصنيف الحركة",
                            "Demonstration rights evidence": "إثبات حقوق الوسائط",
                          }[issue] ?? issue)
                        : issue,
                    )
                    .join(", ")
                : l(
                    "Required bilingual guidance and classification are complete. Demonstrations are optional.",
                    "اكتمل الشرح باللغتين والتصنيف المطلوب. الشرح المرئي اختياري.",
                  )}
            </p>
            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                disabled={locked}
                checked={f.reviewed}
                onChange={(e) => patch("reviewed", e.target.checked)}
              />
              {l("Reviewed bilingual guidance and rights", "تمت مراجعة الشرح باللغتين والحقوق")}
            </label>
            {saved && (
              <p role="status" className="text-sm text-success">
                {l("Exercise changes saved.", "تم حفظ تغييرات التمرين.")}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={locked || !dirty} onClick={prepare}>
                {l("Review exercise changes", "مراجعة تغييرات التمرين")}
              </Button>
              <Button variant="outline" disabled={locked} onClick={() => setReload(true)}>
                {l("Reload saved exercise", "إعادة تحميل التمرين المحفوظ")}
              </Button>
            </div>
          </div>
        )}
      </AdminEditorDrawer>
      <AdminChangeReview review={review} close={() => setReview(null)} />
      <AlertDialog open={reload} onOpenChange={setReload}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {l("Discard this exercise draft?", "إزالة مسودة التمرين؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {l(
                "Reload saved identity, classification, guidance and media. Alternative drafts are separate and retained. Failed reads keep the current draft.",
                "أعد تحميل الاسم والتصنيف والشرح والوسائط المحفوظة. تبقى مسودات البدائل منفصلة ومحفوظة. يحتفظ فشل التحميل بالمسودة الحالية.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{l("Keep editing", "متابعة التعديل")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void reloadExercise()}>
              {l("Discard and reload exercise", "إزالة المسودة وإعادة التحميل")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
