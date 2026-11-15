// Exercise guidance remains independent of catalogue browsing and workout staging.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { appPath } from "@/lib/app-path";
import { trainingLabel } from "@/lib/training-labels";
import { exerciseClassification } from "@/lib/exercise-classification";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";
import { sourceFromGuidance, referenceRepository } from "@/lib/exercise-reference";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { ExerciseDemonstration } from "./exercise-demonstration";
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
  const {
    data: alternatives,
    error,
    isPending,
    fetchStatus,
    refetch,
  } = useQuery({
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
  const cues = locale === "ar" ? guidance.cues_ar : guidance.cues_en;
  const mistakes = locale === "ar" ? guidance.mistakes_ar : guidance.mistakes_en;
  const activeAlternatives = alternatives?.filter((a) => a.exercises?.active) ?? [];
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !choosing) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="flex max-h-[92dvh] flex-col overflow-hidden rounded-t-xl p-0 sm:mx-auto sm:max-w-2xl"
        dir={locale === "ar" ? "rtl" : "ltr"}
        data-stitch-exercise-detail
      >
        {/* Only the reading area scrolls; returning to the workout stays reachable. */}
        <SheetHeader className="shrink-0 border-b border-border p-4 pe-14 text-start">
          <SheetTitle className="font-heading text-xl font-bold">
            {(locale === "ar" && e.name_ar) || e.name_en}
          </SheetTitle>
          <SheetDescription>
            {exerciseClassification(e.muscle, locale)} ·{" "}
            {trainingLabel(e.logging_mode ?? "weighted_reps", locale)} ·{" "}
            {l("Load convention", "طريقة حساب الوزن")}:{" "}
            {trainingLabel(e.load_convention ?? "external_total", locale)}
          </SheetDescription>
        </SheetHeader>
        <div
          className="min-h-0 overflow-y-auto overscroll-contain p-4"
          data-exercise-guidance-scroll
        >
          <ExerciseDemonstration key={e.id} exercise={e} startMedia={startMedia} />
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
          <h3 className="mt-4 font-heading text-sm font-bold">
            {l("Exercise instructions", "تعليمات التمرين")}
          </h3>
          <ol className="my-3 space-y-2 rounded-xl bg-background p-3">
            {(
              steps ??
              e.instructions ??
              l("Written guidance is being prepared.", "يجري إعداد التعليمات المكتوبة.")
            )
              .split("\n")
              .filter(Boolean)
              .map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-card p-3 text-sm leading-6"
                >
                  <span
                    aria-hidden
                    className="shrink-0 text-xs font-semibold tabular-nums text-gold"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p>{s}</p>
                </li>
              ))}
          </ol>
          {cues && (
            <section className="my-3 rounded-xl bg-background p-4">
              <h3 className="mb-2 font-heading text-sm font-bold">
                {l("Execution cues", "إرشادات الأداء")}
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-6">{cues}</p>
            </section>
          )}
          {mistakes && (
            <section className="my-3 rounded-xl border border-border p-4">
              <h3 className="mb-2 font-heading text-sm font-bold">
                {l("Common mistakes", "أخطاء شائعة")}
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {mistakes}
              </p>
            </section>
          )}
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
          {error ? (
            <div className="my-3 space-y-2">
              <p role="alert">{l("Alternatives unavailable", "البدائل غير متاحة")}</p>
              <Button variant="outline" onClick={() => void refetch()}>
                {l("Retry alternatives", "إعادة تحميل البدائل")}
              </Button>
            </div>
          ) : isPending ? (
            <p role="status" className="my-3 text-sm text-muted-foreground">
              {fetchStatus === "paused"
                ? l(
                    "Alternatives are not available offline yet. Written guidance remains available.",
                    "البدائل غير متاحة دون اتصال حالياً. يمكنك قراءة التعليمات المكتوبة.",
                  )
                : l("Loading alternatives…", "جارٍ تحميل البدائل…")}
            </p>
          ) : activeAlternatives.length === 0 ? (
            <p className="my-3 text-sm text-muted-foreground">
              {l(
                "No coach-approved alternatives listed. Ask your coach before substituting.",
                "لا توجد بدائل معتمدة حالياً. اسأل مدربك قبل تغيير التمرين.",
              )}
            </p>
          ) : (
            activeAlternatives.map((a) => (
              <div key={a.alternative_id} className="my-3 space-y-2 rounded-xl bg-background p-4">
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
            ))
          )}
        </div>
        <div
          className="shrink-0 space-y-2 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          data-exercise-guidance-actions
        >
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
          {onChoose && (
            <Button className="w-full" disabled={choosing} onClick={() => onChoose(e.id)}>
              {l("Use exercise", "استخدام التمرين")}
            </Button>
          )}
          <Button className="w-full" variant="outline" disabled={choosing} onClick={onClose}>
            {onChoose
              ? l("Return to exercises", "العودة إلى التمارين")
              : l("Return to workout", "العودة إلى التمرين")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
