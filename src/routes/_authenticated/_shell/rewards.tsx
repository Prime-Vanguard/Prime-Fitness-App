import { MemberSections } from "@/components/member-sections";
import { pageSection } from "@/lib/member-sections";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  readRedemptionIntents,
  reserveRedemptionIntent,
  repriceRedemptionIntent,
  sendRedemptionIntent,
  type RedemptionIntent,
} from "@/lib/redemption-intents";
import { watchMemberState } from "@/lib/member-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { VanguardRoadmap } from "@/components/vanguard-roadmap";
import { XpGuide } from "@/components/xp-guide";
import { PodCommunity } from "@/components/pod-community";
import { ShareAchievement } from "@/components/share-achievement";
import { Trophy, Award, Gift, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RankCrest } from "@/components/rank-crest";
import { useI18n, type TKey } from "@/lib/i18n";
import { useGamification } from "@/hooks/use-gamification";
import { useMe } from "@/hooks/use-me";
import { weekStart } from "@/lib/streaks";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/_shell/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — Prime Fitness" },
      { name: "description", content: "Your XP, level, rank and PV Points in Prime Fitness." },
      { property: "og:title", content: "Rewards — Prime Fitness" },
      {
        property: "og:description",
        content: "Your XP, level, rank and PV Points in Prime Fitness.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
  validateSearch: (
    raw: Record<string, unknown>,
  ): { section?: "journey" | "shop" | "community" | "activity" | undefined } => ({
    section: pageSection(raw["section"], ["journey", "shop", "community", "activity"], "journey"),
  }),
});

const statusCls: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  needs_info: "bg-gold/15 text-gold",
};

function Page() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch(),
    navigate = Route.useNavigate(),
    section = search.section ?? "journey";
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data: g } = useGamification(user.id);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [storedIntents, setIntents] = useState<RedemptionIntent[]>([]),
    [intentOwner, setIntentOwner] = useState(""),
    [redemptionError, setRedemptionError] = useState(""),
    [redeeming, setRedeeming] = useState(false);
  const redemptionLock = useRef(false);
  const [purchase, setPurchase] = useState<{
    rewardId: string;
    cost: number;
    title: string;
    retry: boolean;
  } | null>(null);
  const intentsReady = intentOwner === user.id;
  const intents = intentsReady ? storedIntents : [];
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  useEffect(() => {
    let alive = true;
    const read = () =>
      void readRedemptionIntents(user.id)
        .then((rows) => {
          if (alive) {
            setIntents(rows);
            setIntentOwner(user.id);
          }
        })
        .catch(() => {
          if (alive)
            setRedemptionError(
              locale === "ar"
                ? "تخزين الجهاز غير متاح. لن يتم إرسال طلب مكافأة جديد."
                : "Device storage unavailable. No new reward request will be submitted.",
            );
        });
    read();
    const stop = watchMemberState(read);
    return () => {
      alive = false;
      stop();
    };
  }, [user.id, locale]);

  const {
    data,
    error: rewardsError,
    isPending: rewardsPending,
    refetch: retryRewards,
  } = useQuery({
    queryKey: ["pv", user.id, section],
    enabled: section === "shop" || section === "activity",
    queryFn: async () => {
      const [tasks, claims, rewards, reds] = await Promise.all([
        supabase.from("pv_tasks").select("*").eq("active", true).order("points"),
        supabase
          .from("pv_claims")
          .select("id,status,review_note,created_at,pv_tasks(title_en,title_ar,points)")
          .eq("member_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("rewards").select("*").eq("active", true).order("cost_pv"),
        supabase
          .from("redemptions")
          .select("id,status,review_note,cost_pv,created_at,rewards(title_en,title_ar)")
          .eq("member_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (rewards.error) throw rewards.error;
      if (reds.error) throw reds.error;
      if (tasks.error) throw tasks.error;
      if (claims.error) throw claims.error;
      return { tasks: tasks.data, claims: claims.data, rewards: rewards.data, reds: reds.data };
    },
  });

  const { data: badges } = useQuery({
    queryKey: ["badges", user.id],
    enabled: section === "journey",
    queryFn: async () => {
      const [all, mine] = await Promise.all([
        supabase.from("badges").select("*").order("position"),
        supabase.from("member_badges").select("badge_code,unlocked_at").eq("member_id", user.id),
      ]);
      if (all.error) throw all.error;
      if (mine.error) throw mine.error;
      const got = new Map(mine.data.map((m) => [m.badge_code, m.unlocked_at]));
      return all.data.map((b) => ({ ...b, unlockedAt: got.get(b.code) ?? null }));
    },
  });

  const { data: me } = useMe(user.id);
  const ws = weekStart(new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }));
  const { data: board } = useQuery({
    queryKey: ["leaderboard", ws],
    enabled: section === "community",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaderboard_weekly")
        .select("member_id,xp,display_name,opted_in")
        .eq("week_start", ws)
        .order("xp", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  async function setOptIn(v: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ leaderboard_opt_in: v })
      .eq("id", user.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["me", user.id] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
  }
  const optedIn = !!me?.profile?.leaderboard_opt_in;
  const rows = (board ?? []).filter((r) => r.opted_in || (optedIn && r.member_id === user.id));

  async function claim(taskId: string) {
    const { error } = await supabase
      .from("pv_claims")
      .insert({ task_id: taskId, member_id: user.id, note: notes[taskId]?.trim() || null });
    if (error) return void toast.error(error.message);
    setNotes({ ...notes, [taskId]: "" });
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["pv", user.id] });
  }
  function reviewPurchase(rewardId: string) {
    if (redemptionLock.current || !intentsReady) return;
    const reward = data?.rewards.find((r) => r.id === rewardId),
      saved = intents.find((i) => i.reward_id === rewardId);
    if (!reward && !saved) return;
    setRedemptionError("");
    setPurchase({
      rewardId,
      cost: reward?.cost_pv ?? saved!.cost,
      title: reward ? title(reward) : saved!.title,
      retry: !!saved,
    });
  }
  async function redeem() {
    if (!purchase) return;
    const rewardId = purchase.rewardId;
    if (redemptionLock.current || !intentsReady) return;
    const reward = data?.rewards.find((r) => r.id === rewardId);
    const saved = intents.find((i) => i.reward_id === rewardId);
    if (!saved && (!reward || !reward.active || reward.stock === 0 || !g || g.pv < purchase.cost))
      return;
    if (reward && purchase.cost !== reward.cost_pv) {
      setPurchase({ ...purchase, cost: reward.cost_pv });
      setRedemptionError(
        l(
          "The price changed. Review the updated cost and confirm again.",
          "تغيّر السعر. راجع التكلفة الجديدة وأكّد مجددًا.",
        ),
      );
      return;
    }
    redemptionLock.current = true;
    setRedeeming(true);
    setRedemptionError("");
    try {
      let intent =
        saved ??
        (await reserveRedemptionIntent(user.id, rewardId, reward!.cost_pv, title(reward!)));
      if (intent.cost !== purchase.cost) {
        await repriceRedemptionIntent(user.id, intent.id, purchase.cost);
        intent = { ...intent, cost: purchase.cost };
      }
      await sendRedemptionIntent(user.id, intent);
      setPurchase(null);
      toast.success(t("saved"));
    } catch (error) {
      setPurchase(null);
      setRedemptionError(
        `${l("Request not confirmed. Retry the saved request; do not start another purchase of this reward.", "لم يتأكد الطلب. أعد محاولة الطلب المحفوظ بدلاً من بدء شراء جديد لهذه المكافأة.")} ${(error as { message?: string }).message ?? ""}`,
      );
    } finally {
      redemptionLock.current = false;
      setRedeeming(false);
      void qc.invalidateQueries({ queryKey: ["pv", user.id] });
      void qc.invalidateQueries({ queryKey: ["gamification", user.id] });
    }
  }
  const title = (x: { title_en: string; title_ar: string | null } | null) =>
    (x && ((locale === "ar" && x.title_ar) || x.title_en)) || "";

  return (
    <>
      <PageHeader title={t("rewards")} />
      <Sheet
        open={!!purchase}
        onOpenChange={(open) => {
          if (!open && !redemptionLock.current) setPurchase(null);
        }}
      >
        <SheetContent
          side={locale === "ar" ? "left" : "right"}
          className="w-full overflow-y-auto sm:max-w-lg"
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          <SheetHeader>
            <SheetTitle>{l("Review reward request", "مراجعة طلب المكافأة")}</SheetTitle>
            <SheetDescription>
              {l(
                "Review the reward, PV cost and available balance before confirming.",
                "راجع المكافأة وتكلفتها بنقاط PV والرصيد المتاح قبل التأكيد.",
              )}
            </SheetDescription>
          </SheetHeader>
          {purchase && (
            <div className="mt-6 space-y-4">
              <Gift className="h-10 w-10 text-gold" aria-hidden="true" />
              <h2 className="font-display text-xl font-semibold">{purchase.title}</h2>
              <dl className="space-y-3 rounded-xl border border-gold/40 bg-card p-4">
                <div className="flex justify-between gap-3">
                  <dt>{l("Request cost", "تكلفة الطلب")}</dt>
                  <dd>{purchase.cost} PV</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{l("Current balance", "الرصيد الحالي")}</dt>
                  <dd>{g?.pv ?? "—"} PV</dd>
                </div>
                {!purchase.retry && (
                  <div className="flex justify-between gap-3">
                    <dt>{l("Estimated remaining balance", "الرصيد المتبقي المتوقع")}</dt>
                    <dd>{g ? g.pv - purchase.cost : "—"} PV</dd>
                  </div>
                )}
              </dl>
              {purchase.retry && (
                <p className="text-sm text-muted-foreground">
                  {l(
                    "This checks the same saved request. If it was already accepted, it will not deduct PV again. Your displayed balance may already include that charge.",
                    "يُستخدم الطلب المحفوظ نفسه. إذا قُبل سابقًا فلن تُخصم النقاط مرة أخرى. قد يعكس الرصيد المعروض الخصم السابق بالفعل.",
                  )}
                </p>
              )}
              {!purchase.retry && (
                <p className="text-sm text-muted-foreground">
                  {l(
                    "This is a request for fulfilment. Availability and your final balance are checked when you confirm.",
                    "هذا طلب لتنفيذ المكافأة. يُراجع التوفر والرصيد النهائي عند التأكيد.",
                  )}
                </p>
              )}
              {redemptionError && (
                <p role="alert" className="text-sm text-destructive">
                  {redemptionError}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" disabled={redeeming} onClick={() => setPurchase(null)}>
                  {l("Cancel", "إلغاء")}
                </Button>
                <Button
                  disabled={
                    redeeming || !intentsReady || (!purchase.retry && (!g || g.pv < purchase.cost))
                  }
                  onClick={() => void redeem()}
                >
                  {redeeming
                    ? "…"
                    : purchase.retry
                      ? l("Confirm saved request", "تأكيد الطلب المحفوظ")
                      : l("Confirm reward request", "تأكيد طلب المكافأة")}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {(section === "shop" || section === "activity") && rewardsPending && (
        <p role="status">{l("Loading rewards…", "جارٍ تحميل المكافآت…")}</p>
      )}
      {(section === "shop" || section === "activity") && rewardsError && (
        <p role="alert">
          {l("Could not load rewards.", "تعذر تحميل المكافآت.")}
          <Button variant="outline" onClick={() => void retryRewards()}>
            {l("Retry rewards", "إعادة المحاولة")}
          </Button>
        </p>
      )}
      <MemberSections
        label={l("Rewards sections", "أقسام المكافآت")}
        value={section}
        items={[
          ["journey", l("Journey", "الرحلة")],
          ["shop", t("shop")],
          ["community", l("Community", "المجتمع")],
          ["activity", l("Activity", "النشاط")],
        ]}
        onSelect={(section) =>
          void navigate({ search: { section: section === "journey" ? undefined : section } })
        }
      />
      {section !== "journey" && (
        <p className="mt-4 rounded-xl border border-gold/30 p-4 text-sm">
          {t("pvWallet")}: <strong className="text-gold">{g?.pv ?? "—"} PV</strong>
        </p>
      )}

      {redemptionError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {redemptionError}
        </p>
      )}
      {intents.length > 0 && (
        <section
          className="mt-4 rounded-xl border border-gold/40 p-4"
          aria-label={l("Unconfirmed reward requests", "طلبات مكافآت غير مؤكدة")}
        >
          <h2 className="font-semibold">
            {l("Unconfirmed reward requests", "طلبات مكافآت غير مؤكدة")}
          </h2>
          <p className="my-2 text-sm">
            {l(
              "These requests survive refresh. Checking/retrying uses the same request ID and cannot debit it twice.",
              "تبقى هذه الطلبات بعد تحديث الصفحة. إعادة المحاولة تستخدم نفس رقم الطلب ولا تخصم النقاط مرتين.",
            )}
          </p>
          {intents.map((i) => (
            <div key={i.id} className="mt-2 flex flex-wrap items-center gap-2">
              <span>
                {i.title} · {i.cost} PV
              </span>
              <Button
                disabled={redeeming}
                variant="outline"
                onClick={() => reviewPurchase(i.reward_id)}
              >
                {l("Check / retry request", "تحقق / أعد محاولة الطلب")}
              </Button>
            </div>
          ))}
        </section>
      )}
      {section === "journey" && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <section className="gold-glow rounded-xl border border-gold/40 bg-card p-5">
              <div className="flex items-center gap-3">
                <RankCrest rank={g?.rank.key ?? "Recruit"} size={64} />
                <div>
                  <p className="text-xs uppercase tracking-widest text-gold">
                    {g ? (locale === "ar" ? g.rank.ar : g.rank.key) : "—"}
                  </p>
                  <p className="font-display text-2xl font-bold">
                    {t("level")} {g?.level ?? 1}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{ width: `${Math.round((g?.pct ?? 0) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                {g?.xp ?? 0} {t("xp")} ·{" "}
                {g?.next == null ? t("maxLevel") : `${g.next - g.xp} ${t("toNext")}`}
              </p>
              {g?.provisional && (
                <p className="mt-1 text-[11px] text-muted-foreground">{t("provisional")}</p>
              )}
            </section>
            <section className="relative overflow-hidden rounded-2xl border border-gold/50 bg-gradient-to-br from-card via-background to-card p-5 shadow-lg">
              <div
                aria-hidden
                className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full border border-gold/20"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -end-4 -top-4 h-24 w-24 rounded-full border border-gold/30"
              />
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
                  <Sparkles className="h-4 w-4" />
                  {t("pvWallet")}
                </p>
                <span className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
                  PRIME VANGUARD
                </span>
              </div>
              <p className="mt-6 font-display text-5xl font-bold tabular-nums text-gold">
                {g?.pv ?? "—"}
                <span className="ms-2 text-base font-semibold text-muted-foreground">PV</span>
              </p>
              <div className="mt-4 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
              <p className="mt-3 text-xs text-muted-foreground">{t("pvHint")}</p>
            </section>
          </div>

          <XpGuide />
          {g && (
            <VanguardRoadmap
              level={g.level}
              xp={g.xp}
              displayName={me?.profile?.display_name || t("member")}
              avatarPath={me?.profile?.avatar_url}
            />
          )}
          {g && (
            <div className="mt-3">
              <ShareAchievement
                name={me?.profile?.display_name || t("member")}
                title={`${t("level")} ${g.level}`}
                detail={locale === "ar" ? g.rank.ar : g.rank.key}
                rank={g.rank.key}
              />
            </div>
          )}
        </>
      )}
      {section === "community" && (
        <>
          <PodCommunity userId={user.id} />
        </>
      )}
      {section === "activity" && (
        <>
          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">{t("tasks")}</h2>
            {data?.tasks.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">{t("noTasks")}</p>
            )}
            <ul className="mt-3 space-y-3">
              {data?.tasks.map((x) => (
                <li key={x.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{title(x)}</p>
                    <span className="text-sm font-semibold tabular-nums text-gold">
                      +{x.points} PV
                    </span>
                  </div>
                  {x.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{x.description}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input
                      placeholder={t("claimNote")}
                      value={notes[x.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [x.id]: e.target.value })}
                    />
                    <Button onClick={() => claim(x.id)}>{t("claim")}</Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {section === "community" && (
        <>
          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Trophy className="h-5 w-5 text-gold" />
                {t("leaderboard")}
              </h2>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={optedIn} onCheckedChange={setOptIn} />
                {t("showMe")}
              </label>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("lbHint")}</p>
            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("lbEmpty")}</p>
            ) : (
              <ol className="mt-3 divide-y divide-border text-sm">
                {rows.map((r, i) => (
                  <li
                    key={r.member_id}
                    className={`flex items-center justify-between gap-3 py-2 ${r.member_id === user.id ? "font-semibold text-gold" : ""}`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-6 text-center tabular-nums ${i < 3 ? "text-gold" : "text-muted-foreground"}`}
                      >
                        {i + 1}
                      </span>
                      {r.member_id === user.id ? t("you") : r.display_name || "—"}
                    </span>
                    <span className="tabular-nums">
                      {r.xp} {t("xp")}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
      {section === "journey" && (
        <>
          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Award className="h-5 w-5 text-gold" />
              {t("badges")}
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {badges?.filter((b) => b.unlockedAt).length ?? 0}/{badges?.length ?? 0}
              </span>
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {badges?.map((b) => (
                <li
                  key={b.code}
                  className={`rounded-lg border p-3 text-center ${b.unlockedAt ? "gold-glow border-gold/50" : "border-border opacity-60"}`}
                >
                  <div
                    className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full border-2 ${b.unlockedAt ? "border-gold text-gold" : "border-muted text-muted-foreground"}`}
                  >
                    {b.unlockedAt ? <Award className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </div>
                  <p className="mt-2 text-sm font-semibold">
                    {locale === "ar" ? b.title_ar : b.title_en}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {locale === "ar" ? b.description_ar : b.description_en}
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-gold">
                    {b.unlockedAt
                      ? new Date(b.unlockedAt).toLocaleDateString(
                          locale === "ar" ? "ar-EG" : "en-GB",
                        )
                      : `+${b.xp_bonus} ${t("xp")}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {section === "shop" && (
        <>
          <section className="mt-6 rounded-xl border border-gold/30 bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Gift className="h-5 w-5 text-gold" />
              {t("shop")}
            </h2>
            {data?.rewards.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">{t("noRewards")}</p>
            )}
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {data?.rewards.map((r) => {
                const out = r.stock !== null && r.stock <= 0;
                const poor = !!g && g.pv < r.cost_pv;
                return (
                  <li
                    key={r.id}
                    className="flex flex-col justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{title(r)}</p>
                        <span className="font-semibold tabular-nums text-gold">{r.cost_pv} PV</span>
                      </div>
                      {r.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                      )}
                      {r.stock !== null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.stock} {t("left")}
                        </p>
                      )}
                    </div>
                    <Button
                      disabled={
                        !g ||
                        redeeming ||
                        !intentsReady ||
                        intents.some((i) => i.reward_id === r.id) ||
                        out ||
                        poor
                      }
                      onClick={() => reviewPurchase(r.id)}
                    >
                      {redeeming
                        ? "…"
                        : intents.some((i) => i.reward_id === r.id)
                          ? l("Request unconfirmed", "طلب غير مؤكد")
                          : out
                            ? t("outOfStock")
                            : poor
                              ? t("notEnoughPv")
                              : t("redeem")}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {!!data?.reds.length && (
              <>
                <h3 className="mt-5 text-sm font-semibold">{t("myRedemptions")}</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {data.reds.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3">
                      <div>
                        <p>
                          {title(r.rewards)} ·{" "}
                          <span className="tabular-nums text-muted-foreground">{r.cost_pv} PV</span>
                        </p>
                        {r.review_note && (
                          <p className="text-xs text-muted-foreground">{r.review_note}</p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${r.status === "fulfilled" ? statusCls["approved"] : (statusCls[r.status] ?? "")}`}
                      >
                        {t(r.status as TKey)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
      {section === "activity" && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">{t("myClaims")}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data?.claims.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p>{title(c.pv_tasks)}</p>
                      {c.review_note && (
                        <p className="text-xs text-muted-foreground">{c.review_note}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${statusCls[c.status] ?? ""}`}
                    >
                      {t(c.status as TKey)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">{t("recentXp")}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {g?.recent.map((x) => (
                  <li key={x.id} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {x.source === "level_curve_transition"
                        ? locale === "ar"
                          ? "حماية المستوى السابق"
                          : "Previous level protection"
                        : x.source.replaceAll("_", " ")}
                    </span>
                    <span className="tabular-nums text-gold">+{x.amount}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
