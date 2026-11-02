import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { weekStart } from "@/lib/streaks";

export function PodCommunity({ userId }: { userId: string }) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [pod, setPod] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: me } = useMe(userId);
  const qc = useQueryClient();
  const ws = weekStart(new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }));
  const { data: pods, error: podError } = useQuery({
    queryKey: ["my-pods", userId],
    queryFn: async () => {
      const r = await supabase.from("pods").select("id,name").order("name");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const { data: board, error: boardError } = useQuery({
    queryKey: ["pod-leaderboard", userId, pod, ws],
    enabled: !!pod,
    refetchInterval: 60000,
    queryFn: async () => {
      const r = await supabase
        .from("pod_leaderboard")
        .select("member_id,xp,display_name")
        .eq("pod_id", pod)
        .eq("week_start", ws)
        .order("xp", { ascending: false })
        .order("member_id")
        .limit(100);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const { data: feed, error: feedError } = useQuery({
    queryKey: ["pod-feed", userId, pod],
    enabled: !!pod,
    refetchInterval: 30000,
    queryFn: async () => {
      const r = await supabase
        .from("pod_activity")
        .select("id,member_id,display_name,title,xp,created_at")
        .eq("pod_id", pod)
        .order("created_at", { ascending: false })
        .limit(20);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <UsersRound size={20} className="text-gold" />
        {l("Your Pod", "مجموعتك")}
      </h2>
      <label className="mt-3 block text-sm">
        {l("Leaderboard & activity by Pod", "الصدارة والنشاط حسب المجموعة")}
        <select
          className="mt-2 h-12 w-full rounded border bg-background px-3"
          value={pod}
          onChange={(e) => setPod(e.target.value)}
        >
          <option value="">{l("Choose your Pod", "اختر مجموعتك")}</option>
          {pods?.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {!pods?.length && !podError && (
        <p className="mt-2 text-sm text-muted-foreground">
          {l("Your leader will assign you to a Pod.", "سيعينك قائدك في مجموعة.")}
        </p>
      )}
      <label className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-muted/30 p-3 text-sm">
        <span>
          {l("Share my completed workouts with my Pod", "مشاركة تماريني المكتملة مع مجموعتي")}
          <span className="mt-1 block text-xs text-muted-foreground">
            {l(
              "Off by default. Shares your display name, workout title, and earned XP. Turning off hides your previous feed entries too.",
              "معطلة افتراضياً. تشارك اسمك وعنوان التمرين ونقاط الخبرة. التعطيل يخفي منشوراتك السابقة أيضاً.",
            )}
          </span>
        </span>
        <Switch
          disabled={saving || !me}
          checked={!!me?.profile?.pod_feed_opt_in}
          onCheckedChange={(value) => {
            setSaving(true);
            void supabase
              .from("profiles")
              .update({ pod_feed_opt_in: value })
              .eq("id", userId)
              .then((r) => {
                setSaving(false);
                if (r.error) return void toast.error(r.error.message);
                void qc.invalidateQueries({ queryKey: ["me", userId] });
                void qc.invalidateQueries({ queryKey: ["pod-feed"] });
              });
          }}
        />
      </label>
      {(podError || boardError || feedError) && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {l(
            "Pod activity could not be loaded. Please retry when connected.",
            "تعذر تحميل نشاط المجموعة. حاول عند الاتصال.",
          )}
        </p>
      )}
      {pod && (
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-gold">
              {l("Weekly Pod leaderboard", "صدارة المجموعة الأسبوعية")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {l(
                "Uses your weekly leaderboard opt-in above.",
                "تستخدم اختيار المشاركة في الصدارة أعلاه.",
              )}
            </p>
            <ol className="mt-2 divide-y divide-border">
              {board?.map((r, i) => (
                <li className="flex justify-between gap-2 py-2 text-sm" key={r.member_id}>
                  <span>
                    {i + 1}. {r.member_id === userId ? l("You", "أنت") : r.display_name}
                  </span>
                  <strong className="text-gold">{r.xp} XP</strong>
                </li>
              ))}
            </ol>
            {!board?.length && (
              <p className="mt-3 text-xs text-muted-foreground">
                {l("No opted-in scores this week.", "لا توجد نتائج مشاركة هذا الأسبوع.")}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gold">{l("Pod feed", "نشاط المجموعة")}</h3>
            <ul className="mt-2 space-y-3">
              {feed?.map((r) => (
                <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                  <p>
                    <strong>{r.display_name}</strong> {l("finished", "أكمل")} {r.title}
                  </p>
                  <div className="mt-1 flex justify-between gap-2 text-xs">
                    <span className="text-gold">+{r.xp} XP</span>
                    <time dateTime={r.created_at} className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString(
                        locale === "ar" ? "ar-EG" : "en-GB",
                      )}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
            {!feed?.length && (
              <p className="mt-3 text-xs text-muted-foreground">
                {l(
                  "Completed workouts appear here after members choose to share.",
                  "تظهر التمارين المكتملة بعد اختيار الأعضاء مشاركتها.",
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
