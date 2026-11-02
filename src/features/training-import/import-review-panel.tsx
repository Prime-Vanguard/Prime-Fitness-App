import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { activityDay } from "@/lib/dates";
import type { ImportWorkout } from "@/lib/training-import";
export function ImportReviewPanel({
  workouts,
  dates,
  excludedWorkouts,
  excludedSets,
  historyReview,
  overlaps,
  exclusions,
  consent,
  busy,
  canImport,
  acceptExclusions,
  acceptHistory,
  onContinue,
}: {
  workouts: ImportWorkout[];
  dates: string[];
  excludedWorkouts: number;
  excludedSets: number;
  historyReview: { isPending: boolean; error: unknown; refetch: () => unknown };
  overlaps: {
    id: string;
    activity_date: string | null;
    started_at: string;
    title: string | null;
  }[];
  exclusions: boolean;
  consent: boolean;
  busy: boolean;
  canImport: boolean;
  acceptExclusions: (value: boolean) => void;
  acceptHistory: (value: boolean) => void;
  onContinue: () => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  return (
    <>
      {historyReview.isPending && (
        <p role="status">{l("Checking existing history…", "جارٍ فحص السجل الحالي…")}</p>
      )}
      {!!historyReview.error && (
        <div role="alert">
          {l(
            "Existing history could not be reviewed. Reconnect and retry before importing.",
            "تعذر مراجعة السجل الحالي. اتصل وأعد المحاولة قبل الاستيراد.",
          )}
          <Button variant="outline" onClick={() => void historyReview.refetch()}>
            {l("Retry history review", "إعادة مراجعة السجل")}
          </Button>
        </div>
      )}
      <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
        <p>
          {l("Date range", "الفترة")}:{" "}
          <bdi>
            {dates[0]} → {dates.at(-1)}
          </bdi>
        </p>
        <p>
          {workouts.length} {l("source workouts", "جلسات في المصدر")} · {excludedWorkouts}{" "}
          {l("fully excluded workouts", "جلسات مستبعدة بالكامل")} · {excludedSets}{" "}
          {l("excluded sets", "مجموعات مستبعدة")}
        </p>
        <p>
          {l(
            "Excluded workouts are not submitted. Exact server duplicates are skipped; similar workouts are reviewed, not merged. Imported history earns no XP or streak/schedule credit.",
            "لا تُرسل الجلسات المستبعدة. يستبعد الخادم التكرار المطابق؛ تُراجع الجلسات المتشابهة ولا تُدمج. لا تمنح السجلات المستوردة نقاطاً أو إكمالاً للجدول أو التتابع.",
          )}
        </p>
      </div>
      <details>
        <summary>{l("Preview and warnings", "المعاينة والتحذيرات")}</summary>
        <ul className="max-h-72 overflow-auto">
          {workouts.map((w, i) => (
            <li className="my-2" key={i}>
              {w.activity_date} · {w.title} · {w.sets.length} {l("sets", "مجموعات")}
              <ul>
                {w.warnings.map((warning, j) => (
                  <li className="text-xs text-amber-400" key={j}>
                    {warning}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>
          {l("Potential overlaps in existing history", "تداخلات محتملة في السجل الحالي")} (
          {historyReview.isPending || historyReview.error ? "—" : overlaps.length})
        </summary>
        {!!historyReview.error && (
          <p role="alert">
            {l(
              "Could not complete duplicate review. Reconnect and retry.",
              "تعذر إكمال مراجعة التكرار. اتصل وأعد المحاولة.",
            )}
          </p>
        )}
        {overlaps.slice(0, 100).map((s) => (
          <p key={s.id} className="text-sm">
            {s.activity_date ?? activityDay(s.started_at)} · {s.title}
          </p>
        ))}
      </details>
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={exclusions}
          onChange={(e) => acceptExclusions(e.target.checked)}
        />{" "}
        {l(
          "I accept the listed exclusions / unknown times.",
          "أوافق على الاستبعادات والأوقات غير المعروفة المذكورة.",
        )}
      </label>
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => acceptHistory(e.target.checked)}
        />{" "}
        {l(
          "I reviewed mapping and existing history for overlapping workouts. Similar workouts are not automatically merged.",
          "راجعت التعيين والسجل الحالي بحثاً عن جلسات متداخلة. لن تُدمج الجلسات المتشابهة تلقائياً.",
        )}
      </label>
      <Button disabled={busy || !canImport} onClick={onContinue}>
        {l("Continue to import", "المتابعة للاستيراد")}
      </Button>
    </>
  );
}
