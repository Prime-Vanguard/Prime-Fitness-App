import { useI18n } from "@/lib/i18n";
import { useEffect, useRef } from "react";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { Button } from "./ui/button";
import { ImportMappingPicker } from "./import-mapping-picker";
import { useImportWorkflow } from "@/features/training-import/use-import-workflow";
import { ImportFileStep } from "@/features/training-import/import-file-step";
import { ImportReviewPanel } from "@/features/training-import/import-review-panel";
import { ImportReceipts } from "@/features/training-import/import-receipts";
export function TrainingImport({ userId }: { userId: string }) {
  return <TrainingImportAccount key={userId} userId={userId} />;
}
function TrainingImportAccount({ userId }: { userId: string }) {
  const { data: features } = useTrainingFeatures(userId);
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const wizard = useImportWorkflow(userId, features?.imports === true);
  const steps = useRef<HTMLElement>(null);
  const failure = useRef<HTMLParagraphElement>(null);
  const {
    options,
    workouts,
    mapping,
    error,
    report,
    busy,
    committing,
    consent,
    exclusions,
    progress,
    chunkTotal,
    step,
    furthest,
    fileName,
    attempted,
    receipt,
    acknowledged,
    exercises,
    exercisesError,
    retryExercises,
    dates,
    historyReview,
    overlaps,
    names,
    unresolved,
    excludedSets,
    excludedWorkouts,
    canImport,
  } = wizard;
  useEffect(() => {
    if (busy || !fileName) return;
    const target = error
      ? failure.current
      : steps.current?.querySelector<HTMLElement>('[aria-current="step"]');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }, [step, busy, fileName, error]);
  if (!features?.imports) return null;
  return (
    <section className="mt-6 space-y-3 rounded-xl border border-border p-4">
      <h2 className="font-semibold">{l("Import training history", "استيراد سجل التدريب")}</h2>
      <p className="text-xs text-muted-foreground">
        {l(
          "Strong, Hevy or FitNotes Android workout CSV. History and PRs only; no XP, streaks or schedule changes. 20 MiB / 100,000 rows.",
          "ملف تمارين CSV من Strong أو Hevy أو FitNotes Android. للسجل والأرقام الشخصية فقط، دون نقاط أو أيام متتالية أو تغيير للجدول.",
        )}
      </p>
      <nav
        ref={steps}
        aria-label={l("Import steps", "خطوات الاستيراد")}
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        {[
          l("1. File", "١. الملف"),
          l("2. Mapping", "٢. التعيين"),
          l("3. Review", "٣. المراجعة"),
          l("4. Import", "٤. الاستيراد"),
          l("5. Receipt", "٥. الإيصال"),
        ].map((label, i) => (
          <Button
            key={i}
            className="h-auto min-h-11 whitespace-normal"
            variant={step === i + 1 ? "default" : "outline"}
            aria-current={step === i + 1 ? "step" : undefined}
            disabled={
              busy ||
              i + 1 > furthest ||
              (attempted && i < 3) ||
              (i === 3 && !canImport) ||
              (i === 4 && !receipt)
            }
            onClick={() => wizard.goToStep(i + 1)}
          >
            {label}
          </Button>
        ))}
      </nav>
      {fileName && (
        <p className="break-words text-xs text-muted-foreground">
          {l("Selected file", "الملف المختار")}: {fileName}
        </p>
      )}
      {error && (
        <p
          ref={failure}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {fileName && !busy && !error && step === 2 && (
        <p role="status" className="rounded-lg border border-gold/30 p-3 text-sm">
          {l(
            "File read successfully. Step 2: confirm an exercise match for each name below, then choose Review import.",
            "تمت قراءة الملف بنجاح. الخطوة ٢: أكد مطابقة كل تمرين أدناه ثم اختر مراجعة الاستيراد.",
          )}
        </p>
      )}
      {exercisesError && (
        <div role="alert">
          {l(
            "Exercise catalogue unavailable. Reconnect and retry before mapping.",
            "مكتبة التمارين غير متاحة. اتصل وأعد المحاولة قبل التعيين.",
          )}
          <Button variant="outline" onClick={() => void retryExercises()}>
            {l("Retry catalogue", "إعادة تحميل المكتبة")}
          </Button>
        </div>
      )}
      {step === 1 && (
        <ImportFileStep
          options={options}
          busy={busy}
          hasWorkouts={!!workouts.length}
          fileDisabled={busy || !exercises || !!exercisesError || attempted}
          configure={wizard.configure}
          parse={wizard.parse}
        />
      )}

      {busy && (
        <>
          <p role="status">
            {committing
              ? l("Importing chunks", "جارٍ استيراد الأجزاء")
              : l("Parsing CSV rows", "جارٍ تحليل صفوف CSV")}{" "}
            {committing ? `${acknowledged} / ${chunkTotal}` : progress}
          </p>
          <Button disabled={committing} variant="ghost" onClick={wizard.cancelParsing}>
            {l("Cancel parsing", "إلغاء التحليل")}
          </Button>
        </>
      )}
      {report && <p role="status">{report}</p>}
      {!!workouts.length && (
        <>
          <p>
            {workouts.length} {l("workouts", "جلسات")} · {dates[0]} → {dates.at(-1)}
          </p>
          {step === 2 && (
            <>
              <p role="status" className="text-sm">
                {unresolved} {l("unresolved mappings", "تعيينات غير محسومة")} · {excludedSets}{" "}
                {l("sets explicitly excluded", "مجموعات مستبعدة صراحة")}
              </p>
              {unresolved > 0 && (
                <p className="text-sm text-muted-foreground">
                  {l(
                    "Choose a matching catalogue exercise—or explicitly exclude its sets—for every imported name below. Review import unlocks when all names are resolved.",
                    "اختر تمريناً مطابقاً من المكتبة أو استبعد مجموعاته صراحةً لكل اسم مستورد أدناه. تُتاح مراجعة الاستيراد بعد إكمال جميع المطابقات.",
                  )}
                </p>
              )}
              {!unresolved && excludedWorkouts === workouts.length && (
                <p role="status" className="text-sm text-destructive">
                  {l(
                    "All source workouts are excluded. Keep at least one supported exercise to continue, or reset the preview and choose another file.",
                    "تم استبعاد جميع جلسات المصدر. احتفظ بتمرين مدعوم واحد على الأقل للمتابعة، أو أعد المعاينة واختر ملفاً آخر.",
                  )}
                </p>
              )}
              <Button
                disabled={busy || !!unresolved || excludedWorkouts === workouts.length}
                onClick={wizard.reviewMapping}
              >
                {l("Review import", "مراجعة الاستيراد")}
              </Button>
            </>
          )}
          {step === 2 && (
            <div className="space-y-3">
              {names.map((name) => (
                <ImportMappingPicker
                  key={name}
                  name={name}
                  value={mapping[name] ?? ""}
                  exercises={exercises ?? []}
                  disabled={busy || attempted}
                  onChange={(id) => wizard.changeMapping(name, id)}
                />
              ))}
            </div>
          )}
          {step === 3 && (
            <ImportReviewPanel
              workouts={workouts}
              dates={dates}
              excludedWorkouts={excludedWorkouts}
              excludedSets={excludedSets}
              historyReview={historyReview}
              overlaps={overlaps}
              exclusions={exclusions}
              consent={consent}
              busy={busy}
              canImport={canImport}
              acceptExclusions={wizard.acceptExclusions}
              acceptHistory={wizard.acceptHistory}
              onContinue={wizard.continueImport}
            />
          )}
          {step === 4 && (
            <div className="space-y-2 text-sm">
              <p>
                {l(
                  "Only confirmed mappings are submitted. Keep this page open while chunks are accepted.",
                  "تُرسل التعيينات المؤكدة فقط. أبقِ الصفحة مفتوحة أثناء قبول الأجزاء.",
                )}
              </p>
              <p>
                {acknowledged}{" "}
                {l("chunks acknowledged on this page", "أجزاء تم تأكيدها في هذه الصفحة")}
              </p>
              {attempted && (
                <p>
                  {l(
                    "Mapping is locked after submission, including an uncertain response. Retry this batch unchanged. After a reload, check recent receipts before re-importing the source file.",
                    "يُقفل التعيين بعد الإرسال حتى مع استجابة غير مؤكدة. أعد محاولة الدفعة دون تغيير. بعد إعادة التحميل راجع الإيصالات قبل إعادة استيراد الملف.",
                  )}
                </p>
              )}
            </div>
          )}
          {step === 4 && (
            <Button
              disabled={
                busy || historyReview.isPending || !!historyReview.error || !consent || !canImport
              }
              onClick={() => void wizard.commit()}
            >
              {l("Confirm import / retry", "تأكيد الاستيراد / إعادة المحاولة")}
            </Button>
          )}
          {step === 5 && receipt && (
            <div
              role="status"
              className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-2"
            >
              <p>
                {receipt.accepted} {l("accepted workouts", "جلسات مقبولة")}
              </p>
              <p>
                {l("Duplicates skipped", "جلسات مكررة مستبعدة")}: {receipt.skipped}
              </p>
              <p>
                {excludedWorkouts}{" "}
                {l("fully excluded source workouts", "جلسات مصدر مستبعدة بالكامل")}
              </p>
              <p>
                {receipt.chunks} {l("durably recorded chunks", "أجزاء مسجلة بشكل دائم")}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            disabled={busy || (attempted && step !== 5)}
            onClick={wizard.reset}
          >
            {l("Reset preview", "إعادة المعاينة")}
          </Button>
        </>
      )}
      <ImportReceipts userId={userId} busy={busy} onReport={wizard.reportOutcome} />
    </section>
  );
}
