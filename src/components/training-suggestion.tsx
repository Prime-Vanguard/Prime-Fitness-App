import { trainingReason } from "@/lib/training-labels";
import { useQuery } from "@tanstack/react-query";
import { getTrainingSuggestion } from "@/lib/training-suggestions";
import { readMemberState, changeMemberState } from "@/lib/member-store";
import { contextSuggestion, type TrainingContext } from "@/lib/training-context";
import type { Json } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
export function TrainingSuggestion({
  userId,
  slot,
  exerciseId,
  onUse,
}: {
  userId: string;
  slot: string;
  exerciseId: string;
  onUse: (weight: number | null, reps: number | null, seconds: number | null) => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const { data, error } = useQuery({
    queryKey: ["training-suggestion", userId, slot, exerciseId],
    retry: 0,
    networkMode: "always",
    queryFn: async () => {
      const key = `suggestion:${slot}`;
      if (!navigator.onLine) {
        const cached = (await readMemberState(userId)).references[key] as unknown as
          TrainingContext | undefined;
        return cached
          ? { context: cached, suggestion: contextSuggestion(cached), provisional: true }
          : null;
      }
      const result = await getTrainingSuggestion({ data: { memberId: userId, slot } });
      if (result)
        await changeMemberState(userId, (s) => ({
          ...s,
          references: { ...s.references, [key]: result.context as unknown as Json },
        }));
      return result ? { ...result, provisional: false } : null;
    },
  });
  if (error)
    return (
      <p role="alert" className="mt-3 text-xs">
        {l(
          "Training suggestion unavailable; follow your coach's prescription.",
          "اقتراح التدرج غير متاح؛ اتبع تعليمات مدربك.",
        )}
      </p>
    );
  if (!data || data.context.policy["exercise_id"] !== exerciseId) return null;
  const s = data.suggestion;
  return (
    <aside className="mt-3 rounded border border-gold/30 p-3 text-sm">
      <p className="font-semibold">
        {data.provisional
          ? l("Provisional offline target", "هدف محلي مؤقت")
          : l("Coach-enabled target", "هدف وفق قاعدة المدرب")}
      </p>
      <p>
        {s.weight_kg ?? "—"} kg ·{" "}
        {s.duration_seconds != null
          ? `${s.duration_seconds}s`
          : `${s.reps ?? "—"} ${l("reps", "تكرارات")}`}
      </p>
      <p className="mt-1 text-xs">{trainingReason(s.reason, locale)}</p>
      <p className="text-xs text-muted-foreground">
        {l("Policy revision", "إصدار القاعدة")} {s.revision} ·{" "}
        {l("Training targets do not affect XP rates.", "أهداف التدريب لا تغير معدل نقاط الخبرة.")}
      </p>
      {s.action !== "off" && s.action !== "baseline" && (
        <Button
          className="mt-2"
          size="sm"
          variant="outline"
          onClick={() => onUse(s.weight_kg, s.reps, s.duration_seconds)}
        >
          {l("Use suggested target", "استخدام الهدف المقترح")}
        </Button>
      )}
    </aside>
  );
}
