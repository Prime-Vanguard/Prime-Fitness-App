import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export function XpGuide() {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const { data, isError } = useQuery({
    queryKey: ["xp-rules"],
    staleTime: 300000,
    queryFn: async () => {
      const result = await supabase.from("xp_rules").select("*").single();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const number = (value: number) => value.toLocaleString(locale);
  const weekly = data
    ? 4 * (data.workout_xp ?? 0) + 7 * (data.nutrition_day_xp ?? 0) + (data.body_week_xp ?? 0)
    : 0;
  return (
    <section
      className="mt-6 rounded-2xl border border-gold/30 bg-card p-5"
      aria-labelledby="xp-guide-title"
    >
      <h2 id="xp-guide-title" className="font-display text-lg font-bold">
        {l("Earn your next level", "اكسب مستواك التالي")}
      </h2>
      {!data ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {isError
            ? l(
                "XP rules are unavailable. Reconnect to view earning rates.",
                "قواعد الخبرة غير متاحة. أعد الاتصال لعرض معدلات الكسب.",
              )
            : l("Loading XP rules…", "جارٍ تحميل قواعد الخبرة…")}
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {number(data.level_100_xp ?? 0)} XP · {l("Level 100", "المستوى ١٠٠")}
            {" · "}
            {l("Prime Legend: Levels 91–100", "أسطورة برايم: المستويات ٩١–١٠٠")}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              [
                l("Completed workout", "تمرين مكتمل"),
                data.workout_xp,
                l(
                  `One per day · up to ${data.workout_weekly_cap} per week`,
                  `مرة يومياً · حتى ${data.workout_weekly_cap} أسبوعياً`,
                ),
              ],
              [
                l("Nutrition logging day", "يوم تسجيل التغذية"),
                data.nutrition_day_xp,
                l("Once per day, regardless of meal count", "مرة يومياً مهما كان عدد الوجبات"),
              ],
              [
                l("Body check-in", "قياس الجسم"),
                data.body_week_xp,
                l("Once per week · optional", "مرة أسبوعياً · اختياري"),
              ],
            ].map(([title, xp, detail]) => (
              <div key={String(title)} className="rounded-xl border border-border p-3">
                <dt className="text-sm font-semibold">{title}</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums text-gold">
                  +{number(Number(xp))} XP
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            {l(
              `Four workouts, seven nutrition days and one check-in earn ${number(weekly)} XP a week—about one year to Level 100 from zero, with milestone bonuses. Your pace can vary. Rest days are part of the plan.`,
              `أربعة تمارين وسبعة أيام تغذية وقياس واحد تمنحك ${number(weekly)} نقطة أسبوعياً، أي نحو عام من الصفر للمستوى ١٠٠ مع مكافآت الإنجازات. قد تختلف سرعتك. أيام الراحة جزء من الخطة.`,
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {l(
              `Weeks run Monday–Sunday in Cairo time. Eligible offline logs sync for up to ${data.offline_grace_days} days; earlier history stays saved without new XP. Deleting and restoring logs does not reset reward limits. Body rewards recognize tracking, not weight loss. XP and shop PV remain separate.`,
              `الأسبوع من الاثنين للأحد بتوقيت القاهرة. تُحتسب السجلات المؤهلة غير المتصلة خلال ${data.offline_grace_days} أيام؛ يبقى السجل الأقدم محفوظاً دون خبرة جديدة. الحذف والاستعادة لا يعيدان حدود المكافآت. مكافأة القياس للتسجيل وليست لفقدان الوزن. الخبرة منفصلة عن رصيد المتجر PV.`,
            )}
          </p>
        </>
      )}
    </section>
  );
}
