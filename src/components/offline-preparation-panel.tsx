import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useMemberData } from "@/hooks/use-member-data";
import { useWorkoutSummary } from "@/hooks/use-workout-summary";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { offlinePreparationSchema, personalHistoryCoverage } from "@/lib/offline-preparation";
import {
  prepareOfflineWorkspace,
  preparationAttemptSchema,
} from "@/lib/offline-workspace-preparation";
import { trainingPreparationSchema } from "@/lib/offline-training-preparation";
import { workoutHistoryManifestSchema } from "@/lib/workout-history-cache";
import { adminDate } from "@/lib/admin-format";
import { Button } from "./ui/button";
import { OfflineHistoryRangeControls } from "./offline-history-range-controls";
import { OfflineStorageControls } from "./offline-storage-controls";
import { downloadedHistoryCoverage, type HistoryDateRange } from "@/lib/history-download-range";

function DownloadedDateRanges({ label, ranges }: { label: string; ranges: HistoryDateRange[] }) {
  if (!ranges.length) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {label}:{" "}
      {ranges.map((range, index) => (
        <span key={`${range.from}:${range.to}`}>
          {index > 0 ? " · " : ""}
          <bdi dir="ltr">
            {range.from} – {range.to}
          </bdi>
        </span>
      ))}
    </p>
  );
}

export function OfflinePreparationPanel({ memberId }: { memberId: string }) {
  const { locale } = useI18n();
  const translate = (english: string, arabic: string) => (locale === "ar" ? arabic : english);
  const { state: memberState, error: storageError } = useMemberData(memberId);
  const workout = useWorkoutSummary(memberId);
  const { data: features } = useTrainingFeatures(memberId);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPreparing, setIsPreparing] = useState(false);
  const [hasPreparationError, setHasPreparationError] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<"unknown" | "granted" | "unavailable">(
    "unknown",
  );
  const preparationLock = useRef(false);
  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);
  const parsedManifest = offlinePreparationSchema.safeParse(
    memberState.references["offlinePreparation"],
  );
  const manifest =
    parsedManifest.success && parsedManifest.data.memberId === memberId
      ? parsedManifest.data
      : null;
  async function prepareOfflineData() {
    if (preparationLock.current) return;
    preparationLock.current = true;
    setIsPreparing(true);
    setHasPreparationError(false);
    try {
      await prepareOfflineWorkspace(memberId, true);
    } catch {
      setHasPreparationError(true);
    } finally {
      preparationLock.current = false;
      setIsPreparing(false);
    }
  }
  async function requestPersistentStorage() {
    try {
      setPersistenceStatus((await navigator.storage?.persist?.()) ? "granted" : "unavailable");
    } catch {
      setPersistenceStatus("unavailable");
    }
  }
  const training = trainingPreparationSchema.safeParse(
    memberState.references["trainingPreparation"],
  );
  const trainingManifest =
    training.success && training.data.memberId === memberId ? training.data : null;
  const attempt = preparationAttemptSchema.safeParse(
    memberState.references["offlinePreparationAttempt"],
  );
  const parsedHistory = workoutHistoryManifestSchema.safeParse(
    memberState.references["workoutHistoryManifest"],
  );
  const historyManifest =
    parsedHistory.success && parsedHistory.data.memberId === memberId ? parsedHistory.data : null;
  return (
    <section
      aria-label={translate("Offline preparation", "التجهيز دون اتصال")}
      className="space-y-4 rounded-xl border border-border p-4"
    >
      <h3 className="font-semibold">{translate("Offline & sync", "دون اتصال والمزامنة")}</h3>
      <p role="status" className="text-sm">
        {isOnline
          ? translate("Connection available", "الاتصال متاح")
          : translate(
              "Offline — using saved device data",
              "دون اتصال — استخدام بيانات الجهاز المحفوظة",
            )}
      </p>
      <p className="text-sm">
        {translate(
          "The app automatically prepares 30 days of personal records, your assigned program, schedule and exercise text when connected. Download again to refresh them. Private photos and exercise videos need a connection.",
          "يجهّز التطبيق تلقائيًا 30 يومًا من سجلاتك الشخصية وبرنامجك وجدولك ونصوص التمارين عند الاتصال. أعد التنزيل لتحديثها. تحتاج الصور الخاصة وفيديوهات التمارين إلى اتصال.",
        )}
      </p>
      <p className="text-sm">
        {manifest
          ? translate(
              `Last download: ${adminDate(manifest.preparedAt, locale)} · ${manifest.from} – ${manifest.to}`,
              `آخر تنزيل: ${adminDate(manifest.preparedAt, locale)} · ${manifest.from} – ${manifest.to}`,
            )
          : translate(
              "These records have not been downloaded together yet. Previously saved entries remain available.",
              "لم يتم تنزيل هذه السجلات معًا بعد. تظل السجلات المحفوظة سابقًا متاحة.",
            )}
      </p>
      {manifest && (
        <p className="text-sm">
          {translate("Downloaded records", "السجلات المنزّلة")}:{" "}
          {Object.values(manifest.counts).reduce((total, count) => total + count, 0)}
        </p>
      )}
      <p className="text-sm">
        {trainingManifest
          ? translate(
              `Training downloaded: ${trainingManifest.exerciseCount} exercises · ${trainingManifest.programName ?? "No assigned program"}`,
              `تم تنزيل التدريب: ${trainingManifest.exerciseCount} تمرينًا · ${trainingManifest.programName ?? "لا يوجد برنامج معين"}`,
            )
          : translate(
              "Training has not been prepared on this device yet.",
              "لم يتم تجهيز التدريب على هذا الجهاز بعد.",
            )}
      </p>
      <p className="text-sm">
        {historyManifest
          ? translate(
              `Workout history saved: ${historyManifest.sessionCount} workouts · ${historyManifest.setCount} sets`,
              `سجل التمارين المحفوظ: ${historyManifest.sessionCount} جلسة · ${historyManifest.setCount} مجموعة`,
            )
          : translate(
              "Completed workout history has not been downloaded yet.",
              "لم يتم تنزيل سجل التمارين المكتملة بعد.",
            )}
      </p>
      <p className="text-sm">
        {translate(
          "Personal record changes waiting for server confirmation",
          "تغييرات الطعام والماء والمتابعة التي تنتظر تأكيد الخادم",
        )}
        : {storageError ? "—" : memberState.queue.length}
      </p>
      <DownloadedDateRanges
        label={translate(
          "Downloaded personal record date ranges",
          "نطاقات تواريخ السجلات الشخصية المنزّلة",
        )}
        ranges={personalHistoryCoverage(memberState, memberId)}
      />
      <OfflineHistoryRangeControls
        kind="personal"
        memberId={memberId}
        enabled={isOnline && features?.offline === true && !isPreparing}
      />
      <DownloadedDateRanges
        label={translate("Downloaded workout date ranges", "نطاقات تواريخ التمارين المنزّلة")}
        ranges={historyManifest ? downloadedHistoryCoverage(historyManifest) : []}
      />
      <OfflineHistoryRangeControls
        kind="workouts"
        memberId={memberId}
        enabled={isOnline && features?.offline === true && !isPreparing}
      />
      <OfflineStorageControls
        memberId={memberId}
        state={memberState}
        disabled={!!storageError || isPreparing}
      />
      {workout?.session && (
        <p className="text-sm">
          {translate(
            "An active workout is saved on this device.",
            "يوجد تمرين جارٍ محفوظ على هذا الجهاز.",
          )}
        </p>
      )}
      {(storageError ||
        hasPreparationError ||
        (attempt.success && attempt.data.status === "failed")) && (
        <p role="alert" className="text-sm text-destructive">
          {translate(
            "Offline preparation could not be completed. Check your connection, account access and device storage, then retry. Existing work is retained.",
            "تعذر إكمال التجهيز دون اتصال. تحقق من الاتصال وصلاحية الحساب ومساحة الجهاز ثم أعد المحاولة. عملك السابق محفوظ.",
          )}
        </p>
      )}
      <Button
        variant="outline"
        disabled={!isOnline || features?.offline !== true || isPreparing}
        onClick={() => void prepareOfflineData()}
      >
        {isPreparing
          ? translate("Downloading…", "جارٍ التنزيل…")
          : translate("Download for offline use", "تنزيل للاستخدام دون اتصال")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {translate(
          "Downloads never submit pending edits. Open the app after reconnecting to resume synchronization. Browser data deletion can remove device-only work; export pending changes from Sync & recovery.",
          "لا ترسل التنزيلات التغييرات المعلقة. افتح التطبيق بعد عودة الاتصال لاستئناف المزامنة. قد يؤدي حذف بيانات المتصفح إلى فقدان العمل الموجود على الجهاز فقط؛ صدّر التغييرات المعلقة من المزامنة والاسترداد.",
        )}
      </p>
      <Button variant="outline" onClick={() => void requestPersistentStorage()}>
        {translate("Request persistent device storage", "طلب تخزين دائم على الجهاز")}
      </Button>
      {persistenceStatus !== "unknown" && (
        <p role="status" className="text-xs">
          {persistenceStatus === "granted"
            ? translate(
                "Persistent storage granted. Clearing browser data still removes local records.",
                "تم منح التخزين الدائم. يظل حذف بيانات المتصفح يزيل السجلات المحلية.",
              )
            : translate(
                "Persistent storage was not granted or is unsupported. Keep a backup of pending work.",
                "لم يتم منح التخزين الدائم أو أنه غير مدعوم. احتفظ بنسخة احتياطية من العمل المعلق.",
              )}
        </p>
      )}
    </section>
  );
}
