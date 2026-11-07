import { NativeSelect } from "@/components/ui/native-select";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useShields } from "@/hooks/use-shields";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function StreakShields({
  userId,
  today,
  activeDays,
}: {
  userId: string;
  today: string;
  activeDays: string[];
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const [day, setDay] = useState(today);
  const [busy, setBusy] = useState(false);
  const { data, error } = useShields(userId);
  const qc = useQueryClient();
  const used = data?.filter((d) => d.startsWith(day.slice(0, 7))).length ?? 0;
  const prior = new Date(`${day}T12:00:00Z`);
  prior.setUTCDate(prior.getUTCDate() - 1);
  const all = new Set([...activeDays, ...(data ?? [])]);
  const eligible = all.has(prior.toISOString().slice(0, 10)) && !all.has(day);
  return (
    <div className="mt-4 rounded-lg border border-gold/30 p-3 text-start">
      <p className="flex items-center gap-2 text-sm font-semibold text-gold">
        <Shield size={16} />
        {Math.max(0, 2 - used)}/2 {l("shields left", "دروع متبقية")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {l(
          "Two per calendar month. Protect today or yesterday to continue a streak. Cairo time. No XP is awarded.",
          "درعان كل شهر. احمِ اليوم أو الأمس للحفاظ على التتابع بتوقيت القاهرة. لا تُمنح نقاط خبرة.",
        )}
      </p>
      <label className="mt-2 block text-xs min-w-0 max-w-full">
        {l("Protect day", "حماية يوم")}
        <NativeSelect className="mt-2" value={day} onChange={(e) => setDay(e.target.value)}>
          <option value={today}>
            {l("Today", "اليوم")} · {today}
          </option>
          <option value={yesterday.toISOString().slice(0, 10)}>
            {l("Yesterday", "الأمس")} · {yesterday.toISOString().slice(0, 10)}
          </option>
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
              if (r.error) return void toast.error(r.error.message);
              void qc.invalidateQueries({ queryKey: ["shields", userId] });
              toast.success(l("Streak protected", "تمت حماية التتابع"));
            });
        }}
      >
        {l("Use shield", "استخدام درع")}
      </Button>
      {!eligible && !error && (
        <p className="mt-2 text-[11px] text-muted-foreground">
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
  );
}
