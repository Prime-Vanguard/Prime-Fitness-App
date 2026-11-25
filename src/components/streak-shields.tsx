import { NativeSelect } from "@/components/ui/native-select";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useShields } from "@/hooks/use-shields";
import { ChevronDown, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { addDays, friendlyDay } from "@/lib/dates";

export function StreakShields({
  userId,
  today,
  activeDays,
}: {
  userId: string;
  today: string;
  /** Server activity days (synced food, finished in-app workouts, shields); undefined while loading. */
  activeDays: string[] | undefined;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const yesterday = addDays(today, -1);
  // Keep the choice relative so the date follows `today` past midnight.
  const [choice, setChoice] = useState<"today" | "yesterday">("today");
  const day = choice === "today" ? today : yesterday;
  const [busy, setBusy] = useState(false);
  const { data, error } = useShields(userId);
  const qc = useQueryClient();
  const used = data?.filter((d) => d.startsWith(day.slice(0, 7))).length ?? 0;
  const all = new Set([...(activeDays ?? []), ...(data ?? [])]);
  const eligible = !!activeDays && all.has(addDays(day, -1)) && !all.has(day);
  return (
    // Collapsed to one line unless a shield can be used right now.
    <details
      key={String(eligible)}
      open={eligible || undefined}
      className="group mt-3 rounded-lg border border-gold/30 px-3 text-start"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-gold">
        <Shield size={16} aria-hidden />
        <bdi dir="ltr">{Math.max(0, 2 - used)}/2</bdi> {l("shields left", "دروع متبقية")}
        <ChevronDown
          aria-hidden
          className="ms-auto size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pb-3">
        <p className="mt-1 text-xs text-muted-foreground">
          {l(
            "Two per calendar month. Protect today or yesterday to continue a streak. Cairo time. No XP is awarded.",
            "درعان كل شهر. احمِ اليوم أو الأمس للحفاظ على التتابع بتوقيت القاهرة. لا تُمنح نقاط خبرة.",
          )}
        </p>
        <label className="mt-2 block text-xs min-w-0 max-w-full">
          {l("Protect day", "حماية يوم")}
          <NativeSelect
            className="mt-2"
            value={choice}
            onChange={(e) => setChoice(e.target.value === "yesterday" ? "yesterday" : "today")}
          >
            <option value="today">{friendlyDay(today, locale, today)}</option>
            <option value="yesterday">{friendlyDay(yesterday, locale, today)}</option>
          </NativeSelect>
        </label>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          disabled={busy || !data || !!error || used >= 2 || !eligible}
          onClick={() => {
            setBusy(true);
            void supabase
              .from("streak_shields")
              .insert({ member_id: userId, shield_date: day })
              .then((r) => {
                setBusy(false);
                if (r.error)
                  return void toast.error(
                    l(
                      "Shield not used. Check your connection and try again.",
                      "لم يُستخدم الدرع. تحقق من الاتصال وحاول مرة أخرى.",
                    ),
                  );
                void qc.invalidateQueries({ queryKey: ["shields", userId] });
                toast.success(l("Streak protected", "تمت حماية التتابع"));
              });
          }}
        >
          {l("Use shield", "استخدام درع")}
        </Button>
        {!eligible && !error && activeDays && (
          <p className="mt-2 text-xs text-muted-foreground">
            {all.has(day)
              ? l("Already active or protected.", "نشط أو محمي بالفعل.")
              : l(
                  "A shield needs an active or protected previous day.",
                  "يتطلب الدرع نشاطاً أو حماية في اليوم السابق.",
                )}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs">
            {l(
              "Shields unavailable. Reconnect to check your balance.",
              "الدروع غير متاحة. أعد الاتصال للتحقق من الرصيد.",
            )}
          </p>
        )}
      </div>
    </details>
  );
}
