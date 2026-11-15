import { Check, CloudUpload, TriangleAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** A local save is deliberately distinct from server acceptance. */
export function FoodSaveState({
  pending,
  review,
  sending,
}: {
  pending: boolean;
  review: boolean;
  sending: boolean;
}) {
  const { locale } = useI18n();
  const Icon = review ? TriangleAlert : pending ? CloudUpload : Check;
  return (
    <p
      data-food-save-state
      className={`save-state flex items-center gap-1.5 text-xs ${review ? "text-pending" : pending ? "text-info" : "text-success"}`}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {review
        ? locale === "ar"
          ? "محفوظ على الجهاز · يحتاج إلى مراجعة"
          : "Saved on device · needs review"
        : sending
          ? locale === "ar"
            ? "محفوظ على الجهاز · جارٍ التزامن"
            : "Saved on device · syncing"
          : pending
            ? locale === "ar"
              ? "محفوظ على الجهاز · بانتظار المزامنة"
              : "Saved on device · waiting to sync"
            : locale === "ar"
              ? "تمت المزامنة"
              : "Synced"}
    </p>
  );
}
