import { Check, CloudOff, CloudUpload, TriangleAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { workoutSyncState } from "./workout-sync-state";

export function WorkoutSyncStatus({
  online,
  pending,
  error,
}: {
  online: boolean;
  pending: number;
  error: boolean;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const state = workoutSyncState(online, pending, error);
  const Icon =
    state === "attention"
      ? TriangleAlert
      : state === "pending"
        ? CloudUpload
        : state === "offline"
          ? CloudOff
          : Check;
  const text =
    state === "attention"
      ? ar
        ? "تحتاج المزامنة إلى معالجة"
        : "Sync needs attention"
      : state === "pending"
        ? ar
          ? `${online ? "" : "دون اتصال · "}محفوظ على الجهاز · بانتظار المزامنة`
          : `${online ? "" : "Offline · "}Saved on device · waiting to sync`
        : state === "offline"
          ? ar
            ? "دون اتصال · لا توجد تغييرات معلقة"
            : "Offline · no pending changes"
          : ar
            ? "تمت المزامنة"
            : "Synced";
  return (
    <div
      role="status"
      data-workout-sync-state={state}
      className={
        state === "synced"
          ? "sr-only"
          : "mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
      }
    >
      <Icon
        aria-hidden="true"
        className={`size-4 shrink-0 ${state === "attention" ? "text-pending" : "text-info"}`}
      />
      <span>{text}</span>
    </div>
  );
}
