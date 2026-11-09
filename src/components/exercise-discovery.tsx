import { NativeSelect } from "@/components/ui/native-select";
import { trainingLabel } from "@/lib/training-labels";
import { appPath } from "@/lib/app-path";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { discoverExercises, type ExerciseGuidance } from "@/lib/exercise-guidance";
import { sourceFromGuidance, referenceRepository } from "@/lib/exercise-reference";
import { useI18n } from "@/lib/i18n";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { ExerciseThumbnail } from "./exercise-thumbnail";
import { ExerciseDemonstration } from "./exercise-demonstration";
export function ExerciseDiscovery({
  exercises,
  onChoose,
  preferred = [],
  disabled = false,
}: {
  exercises: ExerciseGuidance[];
  onChoose: (id: string) => void | Promise<void>;
  preferred?: string[];
  disabled?: boolean;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [q, setQ] = useState("");
  const [equipment, setEquipment] = useState("");
  const [muscle, setMuscle] = useState("");
  const [mode, setMode] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const [detail, setDetail] = useState<{ exercise: ExerciseGuidance; play: boolean } | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const selectionLock = useRef(false);
  async function choose(id: string) {
    if (disabled || selectionLock.current) return;
    selectionLock.current = true;
    setChoosing(true);
    setSelectionError("");
    try {
      await onChoose(id);
      setDetail(null);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : String(error));
    } finally {
      selectionLock.current = false;
      setChoosing(false);
    }
  }
  const results = discoverExercises(exercises, q, { equipment, muscle, mode, preferred });
  return (
    <section className="mt-4 space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">{l("Exercise library", "مكتبة التمارين")}</h3>
      {selectionError && (
        <p role="alert" className="text-sm text-destructive">
          {selectionError}
        </p>
      )}
      {choosing && (
        <p role="status" className="text-sm">
          {l("Saving exercise on this device…", "جارٍ حفظ التمرين على الجهاز…")}
        </p>
      )}
      <Input
        aria-label={l("Search exercises", "ابحث عن تمرين")}
        placeholder={l("Name or alias", "الاسم أو الاسم البديل")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid grid-cols-3 gap-2">
        {[
          [
            equipment,
            setEquipment,
            l("Equipment", "الأدوات"),
            [
              ...new Set(
                exercises.flatMap((e) => e.equipment_tags ?? (e.equipment ? [e.equipment] : [])),
              ),
            ],
          ],
          [muscle, setMuscle, l("Muscle", "العضلة"), [...new Set(exercises.map((e) => e.muscle))]],
          [
            mode,
            setMode,
            l("Logging mode", "نوع التسجيل"),
            ["weighted_reps", "bodyweight_reps", "timed"],
          ],
        ].map(([value, setter, label, options]) => (
          <label key={String(label)} className="text-xs min-w-0 max-w-full block">
            {String(label)}
            <NativeSelect
              className="mt-2"
              value={String(value)}
              onChange={(e) => (setter as (s: string) => void)(e.target.value)}
            >
              <option value="">{l("All", "الكل")}</option>
              {(options as string[]).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {results.length}{" "}
        {l(
          "matches · program and recent exercises first",
          "نتيجة · تمارين البرنامج والتمارين الأخيرة أولاً",
        )}
      </p>
      <ul className="max-h-72 overflow-auto divide-y">
        {results.slice(0, visibleCount).map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2 py-2">
            <ExerciseThumbnail
              exercise={e}
              name={(locale === "ar" && e.name_ar) || e.name_en}
              onOpen={() => setDetail({ exercise: e, play: true })}
            />
            <button
              className="min-h-11 min-w-0 flex-1 text-start"
              onClick={() => setDetail({ exercise: e, play: false })}
            >
              {(locale === "ar" && e.name_ar) || e.name_en}
              <span className="block text-xs text-muted-foreground">
                {e.muscle} · {(e.equipment_tags ?? [e.equipment]).join(", ")}
              </span>
            </button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || choosing || e.guidance?.catalogue_kind === "cardio"}
              onClick={() => void choose(e.id)}
            >
              {e.guidance?.catalogue_kind === "cardio" ? l("Cardio", "كارديو") : l("Use", "استخدم")}
            </Button>
          </li>
        ))}
      </ul>
      {results.length > visibleCount && (
        <Button variant="outline" onClick={() => setVisibleCount((n) => n + 60)}>
          {l("Show more exercises", "عرض المزيد من التمارين")} (
          {Math.min(visibleCount, results.length)} / {results.length})
        </Button>
      )}
      {detail && (
        <ExerciseDetail
          key={detail.exercise.id}
          exercise={detail.exercise}
          startMedia={detail.play}
          onClose={() => {
            if (!choosing) setDetail(null);
          }}
          choosing={choosing || disabled}
          selectionError={selectionError}
          onChoose={
            detail.exercise.guidance?.catalogue_kind === "cardio"
              ? undefined
              : (id) => void choose(id)
          }
        />
      )}
    </section>
  );
}
export function ExerciseDetail({
  exercise: e,
  onClose,
  onChoose,
  startMedia = false,
  choosing = false,
  selectionError = "",
}: {
  exercise: ExerciseGuidance;
  onClose: () => void;
  onChoose?: ((id: string) => void) | undefined;
  startMedia?: boolean;
  choosing?: boolean;
  selectionError?: string;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [downloadError, setDownloadError] = useState("");
  async function download() {
    if (!e.media) return;
    setDownloadError("");
    try {
      const response = await fetch(e.media.url, {
        credentials: "omit",
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok || !response.body) throw new Error("Download unavailable");
      const type = response.headers.get("content-type")?.split(";")[0] ?? "";
      if (
        !type.startsWith("video/") &&
        !["image/gif", "image/webp", "image/png", "image/jpeg"].includes(type)
      )
        throw new Error("Unsupported demonstration format");
      const reader = response.body.getReader(),
        chunks: ArrayBuffer[] = [];
      let size = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 25 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("Demonstration exceeds 25 MiB");
        }
        chunks.push(value.slice().buffer);
      }
      const url = URL.createObjectURL(new Blob(chunks, { type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `prime-exercise-demo.${type === "video/webm" ? "webm" : type.startsWith("video/") ? "mp4" : type.split("/")[1]}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDownloadError(
        l(
          "This demonstration cannot be downloaded from its host. Playback remains available online.",
          "تعذر تنزيل الشرح من المصدر. يمكنك تشغيله عند الاتصال.",
        ),
      );
    }
  }
  const { data: alternatives, error } = useQuery({
    queryKey: ["exercise-alternatives", e.id],
    queryFn: async () => {
      const r = await supabase
        .from("exercise_alternatives")
        .select(
          "alternative_id,reason_en,reason_ar,exercises!exercise_alternatives_alternative_id_fkey(id,name_en,name_ar,active)",
        )
        .eq("exercise_id", e.id);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const guidance = e.guidance ?? {};
  const textSource = sourceFromGuidance(e.guidance);
  const steps = locale === "ar" ? guidance.steps_ar : guidance.steps_en;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="overflow-auto" dir={locale === "ar" ? "rtl" : "ltr"}>
        <SheetHeader>
          <SheetTitle>{(locale === "ar" && e.name_ar) || e.name_en}</SheetTitle>
          <SheetDescription>
            {e.muscle} · {trainingLabel(e.logging_mode ?? "weighted_reps", locale)} ·{" "}
            {l("Load convention", "طريقة حساب الوزن")}:{" "}
            {trainingLabel(e.load_convention ?? "external_total", locale)}
          </SheetDescription>
        </SheetHeader>
        {onChoose && (
          <div className="my-3 space-y-2">
            <Button disabled={choosing} onClick={() => onChoose(e.id)}>
              {l("Use exercise", "استخدام التمرين")}
            </Button>
            {choosing && (
              <p role="status">
                {l("Saving exercise on this device…", "جارٍ حفظ التمرين على الجهاز…")}
              </p>
            )}
            {selectionError && (
              <p role="alert" className="text-sm text-destructive">
                {selectionError}
              </p>
            )}
          </div>
        )}
        {e.editorial_status !== "reviewed" && (
          <p className="my-3 text-sm text-amber-400">
            {l(
              "Editorial review pending. Ask your coach for setup guidance.",
              "المراجعة التدريبية قيد الانتظار. اسأل مدربك عن طريقة الأداء.",
            )}
          </p>
        )}
        {e.guidance?.catalogue_kind === "cardio" && (
          <p className="my-3 text-sm">
            {l(
              "Reference activity: use Train → Cardio & HIIT to log cardio metrics, separately from strength sets.",
              "نشاط مرجعي: استخدم التدريب ← الكارديو والتمارين المتقطعة لتسجيل الكارديو بشكل منفصل عن مجموعات القوة.",
            )}
          </p>
        )}
        {locale === "ar" &&
          e.editorial_status !== "reviewed" &&
          guidance.translation?.status === "machine_draft" && (
            <p className="my-3 text-sm text-amber-400">
              {l(
                "Machine-translated draft; compare the English original and ask your coach if anything is unclear.",
                "ترجمة آلية أولية؛ راجع النص الإنجليزي واسأل مدربك إذا كانت أي خطوة غير واضحة.",
              )}
            </p>
          )}
        {locale === "ar" && guidance.translation?.status === "machine_draft" && (
          <details className="my-3 text-sm">
            <summary>{l("English original", "النص الإنجليزي الأصلي")}</summary>
            <p dir="ltr" className="whitespace-pre-line text-start">
              {guidance.steps_en}
            </p>
          </details>
        )}
        <ol className="my-4 list-inside list-decimal space-y-2">
          {(
            steps ??
            e.instructions ??
            l("Written guidance is being prepared.", "يجري إعداد التعليمات المكتوبة.")
          )
            .split("\n")
            .filter(Boolean)
            .map((s, i) => (
              <li key={i}>{s}</li>
            ))}
        </ol>
        <p className="whitespace-pre-wrap text-sm">
          {locale === "ar" ? guidance.cues_ar : guidance.cues_en}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {locale === "ar" ? guidance.mistakes_ar : guidance.mistakes_en}
        </p>
        {textSource && (
          <p className="mt-3 text-xs text-muted-foreground">
            {l("Guidance adapted from", "الشرح مقتبس من")} © 2026 Hasan Emir Yıldırım ·{" "}
            <a
              className="underline"
              href={`https://github.com/${referenceRepository}/tree/${textSource.revision}`}
              target="_blank"
              rel="noreferrer"
            >
              {l("Source", "المصدر")}
            </a>{" "}
            ·{" "}
            <a
              className="underline"
              href={appPath("legal/exercise-dataset-LICENSE.txt")}
              target="_blank"
              rel="noreferrer"
            >
              MIT
            </a>
          </p>
        )}
        <ExerciseDemonstration key={e.id} exercise={e} startMedia={startMedia} />
        {e.media && e.editorial_status === "reviewed" && (
          <div className="my-4">
            <Button className="mt-2" variant="outline" onClick={() => void download()}>
              {l("Download demonstration file", "تنزيل ملف الشرح")}
            </Button>
            {downloadError && (
              <p role="alert" className="text-xs">
                {downloadError}
              </p>
            )}
          </div>
        )}
        <h4 className="mt-5 font-semibold">
          {l("Coach-approved alternatives", "بدائل معتمدة من المدرب")}
        </h4>
        {error && <p role="alert">{l("Alternatives unavailable", "البدائل غير متاحة")}</p>}
        {alternatives
          ?.filter((a) => a.exercises?.active)
          .map((a) => (
            <div key={a.alternative_id} className="my-3">
              <p>{(locale === "ar" && a.exercises?.name_ar) || a.exercises?.name_en}</p>
              <p className="text-xs">{locale === "ar" ? a.reason_ar : a.reason_en}</p>
              {onChoose && (
                <Button
                  disabled={choosing}
                  variant="outline"
                  onClick={() => onChoose(a.alternative_id)}
                >
                  {l("Use alternative", "استخدام البديل")}
                </Button>
              )}
            </div>
          ))}
      </SheetContent>
    </Sheet>
  );
}
