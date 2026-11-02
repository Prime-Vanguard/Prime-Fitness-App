import { useI18n } from "@/lib/i18n";
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
      {error && <p role="alert">{error}</p>}
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
