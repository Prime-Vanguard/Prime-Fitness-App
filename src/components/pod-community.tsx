import { NativeSelect } from "@/components/ui/native-select";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { weekStart } from "@/lib/streaks";
import { useActivityDay } from "@/hooks/use-activity-day";

export function PodCommunity({ userId, active = true }: { userId: string; active?: boolean }) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [pod, setPod] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: me } = useMe(userId);
  const qc = useQueryClient();
  const today = useActivityDay();
  const ws = weekStart(today);
  const {
    data: pods,
    error: podError,
    isPending: podsPending,
    refetch: retryPods,
  } = useQuery({
    queryKey: ["my-pods", userId],
    enabled: active,
    queryFn: async () => {
      const r = await supabase.from("pods").select("id,name").order("name");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const {
    data: board,
    error: boardError,
    isPending: boardPending,
    refetch: retryBoard,
  } = useQuery({
    queryKey: ["pod-leaderboard", userId, pod, ws],
    enabled: active && !!pod,
    refetchInterval: active ? 60000 : false,
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
  const {
    data: feed,
    error: feedError,
    isPending: feedPending,
    refetch: retryFeed,
  } = useQuery({
    queryKey: ["pod-feed", userId, pod],
    enabled: active && !!pod,
    refetchInterval: active ? 30000 : false,
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
    <section
      id="community-pods"
      className="mt-6 scroll-mt-24 rounded-xl border border-border bg-card p-4 sm:p-5"
      data-stitch-pod
    >
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <UsersRound size={20} className="text-gold" />
        {l("Your Pod", "مجموعتك")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {l(
          "Your weekly leaderboard and shared workout activity. Only members who choose to share appear here.",
          "الصدارة الأسبوعية ونشاط التمارين المشترك. يظهر فقط الأعضاء الذين يختارون المشاركة.",
        )}
      </p>
      <label className="mt-3 block text-sm min-w-0 max-w-full">
        {l("Leaderboard & activity by Pod", "الصدارة والنشاط حسب المجموعة")}
        <NativeSelect className="mt-2" value={pod} onChange={(e) => setPod(e.target.value)}>
          <option value="">{l("Choose your Pod", "اختر مجموعتك")}</option>
          {pods?.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      {podsPending && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {l("Loading your Pods…", "جارٍ تحميل مجموعاتك…")}
        </p>
      )}
      {!pods?.length && !podError && !podsPending && (
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
          <button
            className="ms-2 min-h-11 underline"
            onClick={() => {
              void retryPods();
              if (pod) {
                void retryBoard();
                void retryFeed();
              }
            }}
          >
            {l("Retry Pod activity", "إعادة تحميل نشاط المجموعة")}
          </button>
        </p>
      )}
      {pod && (
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="min-w-0 rounded-lg bg-background p-3">
            <h3 className="text-sm font-semibold text-gold">
              {l("Weekly Pod leaderboard", "صدارة المجموعة الأسبوعية")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {l(
                "Uses your weekly leaderboard opt-in above.",
                "تستخدم اختيار المشاركة في الصدارة أعلاه.",
              )}
            </p>
            {boardPending && (
              <p role="status" className="mt-3 text-xs">
                {l("Loading scores…", "جارٍ تحميل النتائج…")}
              </p>
            )}
            <ol className="mt-2 divide-y divide-border">
              {board?.map((r, i) => (
                <li
                  className={`flex flex-wrap justify-between gap-2 py-3 text-sm ${r.member_id === userId ? "text-gold" : ""}`}
                  key={r.member_id}
                >
                  <span className="min-w-0 break-words">
                    {i + 1}. {r.member_id === userId ? l("You", "أنت") : r.display_name}
                  </span>
                  <strong className="text-gold">{r.xp} XP</strong>
                </li>
              ))}
            </ol>
            {!board?.length && !boardPending && !boardError && (
              <p className="mt-3 text-xs text-muted-foreground">
                {l("No opted-in scores this week.", "لا توجد نتائج مشاركة هذا الأسبوع.")}
              </p>
            )}
          </div>
          <div className="min-w-0 rounded-lg bg-background p-3">
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
                        { timeZone: "Africa/Cairo" },
                      )}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
            {feedPending && (
              <p role="status" className="mt-3 text-xs">
                {l("Loading Pod feed…", "جارٍ تحميل نشاط المجموعة…")}
              </p>
            )}
            {!feed?.length && !feedPending && !feedError && (
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
