import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { MemberState } from "@/lib/member-store";
import { removableHistoryBytes } from "@/lib/offline-history-storage";
import { removeOfflineHistory } from "@/lib/offline-workspace-preparation";
import { AdminChangeReview, type AdminReview } from "./admin-change-review";
import { Button } from "./ui/button";

export function OfflineStorageControls({
  memberId,
  state,
  disabled,
}: {
  memberId: string;
  state: MemberState;
  disabled: boolean;
}) {
  const { locale } = useI18n();
  const label = (english: string, arabic: string) => (locale === "ar" ? arabic : english);
  const [quota, setQuota] = useState<StorageEstimate | null>(null);
  const [review, setReview] = useState<AdminReview | null>(null);
  const historyBytes = useMemo(() => removableHistoryBytes(state), [state]);
  const paused = state.references["offlineHistoryPaused"] === true;
  useEffect(() => {
    let active = true;
    void navigator.storage
      ?.estimate?.()
      .then((estimate) => {
        if (active) setQuota(estimate);
      })
      .catch(() => {
        if (active) setQuota(null);
      });
    return () => {
      active = false;
    };
  }, [historyBytes]);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const formatBytes = (bytes: number) =>
    bytes >= 1024 ** 2
      ? `${number.format(bytes / 1024 ** 2)} ${label("MB", "م.ب")}`
      : `${number.format(bytes / 1024)} ${label("KB", "ك.ب")}`;
  const hasQuota =
    typeof quota?.usage === "number" && typeof quota.quota === "number" && quota.quota > 0;

  return (
    <section
      className="space-y-3 rounded-lg border border-border p-3"
      aria-label={label("Offline storage", "التخزين دون اتصال")}
    >
      <h4 className="font-semibold">{label("Offline storage", "التخزين دون اتصال")}</h4>
      <dl className="space-y-2 text-sm">
        <div>
          <dt>{label("Removable history (estimate)", "السجل القابل للإزالة (تقديري)")}</dt>
          <dd>{disabled ? "—" : formatBytes(historyBytes)}</dd>
        </div>
        <div>
          <dt>{label("Browser site storage (estimate)", "مساحة الموقع في المتصفح (تقديرية)")}</dt>
          <dd>
            {hasQuota
              ? label(
                  `${formatBytes(quota.usage!)} used of ${formatBytes(quota.quota!)}`,
                  `المستخدم ${formatBytes(quota.usage!)} من ${formatBytes(quota.quota!)}`,
                )
              : label("Storage estimate unavailable", "تقدير المساحة غير متاح")}
          </dd>
        </div>
      </dl>
      {paused && (
        <p role="status" className="text-sm">
          {label(
            "Automatic history downloads are paused. Select Download for offline use to resume them. Recent records may be saved again as you use the app.",
            "التنزيل التلقائي للسجل متوقف مؤقتًا. اختر التنزيل للاستخدام دون اتصال لاستئنافه. قد تُحفظ السجلات الأخيرة مجددًا أثناء استخدام التطبيق.",
          )}
        </p>
      )}
      <Button
        variant="outline"
        disabled={disabled || (!historyBytes && paused)}
        onClick={() =>
          setReview({
            title: label("Remove downloaded history?", "إزالة السجل المنزّل؟"),
            description: label(
              "This frees space on this device and pauses automatic history downloads.",
              "يحرر هذا مساحة على الجهاز ويوقف التنزيل التلقائي للسجل مؤقتًا.",
            ),
            details: (
              <p>
                {label(
                  "Previously saved food, water, measurements, check-ins and completed workout history will need a new download for offline use. Active workouts, pending changes and undo data are kept.",
                  "تحتاج سجلات الطعام والماء والقياسات والمتابعة والتمارين المكتملة إلى تنزيل جديد للاستخدام دون اتصال. تبقى التمارين الجارية والتغييرات المعلقة وبيانات التراجع محفوظة.",
                )}
              </p>
            ),
            save: async () => {
              await removeOfflineHistory(memberId);
            },
          })
        }
      >
        {label("Remove downloaded history", "إزالة السجل المنزّل")}
      </Button>
      <AdminChangeReview review={review} close={() => setReview(null)} />
    </section>
  );
}
