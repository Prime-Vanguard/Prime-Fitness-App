import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { activityDay, addDays } from "@/lib/dates";
import { historyDownloadRangeSchema } from "@/lib/history-download-range";
import {
  prepareAdditionalPersonalHistory,
  prepareAdditionalWorkoutHistory,
} from "@/lib/offline-workspace-preparation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function OfflineHistoryRangeControls({
  memberId,
  enabled,
  kind,
}: {
  memberId: string;
  enabled: boolean;
  kind: "workouts" | "personal";
}) {
  const { locale } = useI18n();
  const translate = (english: string, arabic: string) => (locale === "ar" ? arabic : english);
  const inputId = useId();
  const queryClient = useQueryClient();
  const [range, setRange] = useState(() => ({
    from: addDays(activityDay(), -89),
    to: activityDay(),
  }));
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "failed" | "saved">("idle");
  const downloadLock = useRef(false);
  const validatedRange = historyDownloadRangeSchema.safeParse(range);
  const isPersonal = kind === "personal";
  async function downloadHistory() {
    if (downloadLock.current || !validatedRange.success) return;
    downloadLock.current = true;
    setIsDownloading(true);
    setDownloadStatus("idle");
    try {
      if (isPersonal) {
        await prepareAdditionalPersonalHistory(memberId, validatedRange.data);
      } else {
        await prepareAdditionalWorkoutHistory(memberId, validatedRange.data);
        for (const key of ["sessions", "linked-workout", "workout-history-detail"])
          void queryClient.invalidateQueries({ queryKey: [key, memberId] });
      }
      setDownloadStatus("saved");
    } catch {
      setDownloadStatus("failed");
    } finally {
      downloadLock.current = false;
      setIsDownloading(false);
    }
  }
  return (
    <fieldset
      className="space-y-3 rounded-lg border border-border p-3"
      disabled={!enabled || isDownloading}
    >
      <legend className="px-1 text-sm font-semibold">
        {isPersonal
          ? translate("Download older personal records", "تنزيل سجلات شخصية أقدم")
          : translate("Download older workout history", "تنزيل سجل تمارين أقدم")}
      </legend>
      <p className="text-xs text-muted-foreground">
        {isPersonal
          ? translate(
              "Choose up to 366 days of food, water, measurements and wellness check-ins. Existing downloads and pending edits are retained.",
              "اختر حتى 366 يومًا من سجلات الطعام والماء والقياسات والمتابعة اليومية. تُحفظ التنزيلات السابقة والتغييرات المعلقة.",
            )
          : translate(
              "Choose up to 366 days of completed workouts and their sets. Existing downloads and pending edits are retained.",
              "اختر حتى 366 يومًا من التمارين المكتملة ومجموعاتها. تُحفظ التنزيلات السابقة والتغييرات المعلقة.",
            )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${inputId}-from`} className="text-sm">
            {isPersonal
              ? translate("Personal records start date", "تاريخ بداية السجلات الشخصية")
              : translate("History start date", "تاريخ بداية السجل")}
          </label>
          <Input
            id={`${inputId}-from`}
            type="date"
            value={range.from}
            max={activityDay()}
            onChange={(event) => {
              setRange((current) => ({ ...current, from: event.target.value }));
              setDownloadStatus("idle");
            }}
            aria-invalid={!validatedRange.success}
            aria-describedby={!validatedRange.success ? `${inputId}-error` : undefined}
          />
        </div>
        <div>
          <label htmlFor={`${inputId}-to`} className="text-sm">
            {isPersonal
              ? translate("Personal records end date", "تاريخ نهاية السجلات الشخصية")
              : translate("History end date", "تاريخ نهاية السجل")}
          </label>
          <Input
            id={`${inputId}-to`}
            type="date"
            value={range.to}
            max={activityDay()}
            onChange={(event) => {
              setRange((current) => ({ ...current, to: event.target.value }));
              setDownloadStatus("idle");
            }}
            aria-invalid={!validatedRange.success}
            aria-describedby={!validatedRange.success ? `${inputId}-error` : undefined}
          />
        </div>
      </div>
      {!validatedRange.success && (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">
          {translate(
            "Choose valid dates, ending no later than today, with at most 366 days per download.",
            "اختر تواريخ صحيحة لا تتجاوز اليوم، وبحد أقصى 366 يومًا لكل تنزيل.",
          )}
        </p>
      )}
      <Button
        variant="outline"
        disabled={!validatedRange.success}
        onClick={() => void downloadHistory()}
      >
        {isDownloading
          ? translate("Downloading history…", "جارٍ تنزيل السجل…")
          : isPersonal
            ? translate("Download selected personal records", "تنزيل السجلات الشخصية المحددة")
            : translate("Download selected history", "تنزيل السجل المحدد")}
      </Button>
      {downloadStatus === "saved" && (
        <p role="status" className="text-sm">
          {isPersonal
            ? translate(
                "Selected personal records saved on this device.",
                "تم حفظ السجلات الشخصية المحددة على هذا الجهاز.",
              )
            : translate(
                "Selected history saved on this device.",
                "تم حفظ السجل المحدد على هذا الجهاز.",
              )}
        </p>
      )}
      {downloadStatus === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {translate(
            "The history download could not be completed. Check your connection, account access and device storage, then retry. Previous downloads remain available.",
            "تعذر إكمال تنزيل السجل. تحقق من الاتصال وصلاحية الحساب ومساحة الجهاز ثم أعد المحاولة. تبقى التنزيلات السابقة متاحة.",
          )}
        </p>
      )}
    </fieldset>
  );
}
