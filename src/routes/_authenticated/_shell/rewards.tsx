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
import { SocialPanel } from "@/features/social/social-panel";
import { ShareAchievement } from "@/components/share-achievement";
import { Trophy, Award, Gift, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RewardSummary } from "@/features/rewards/reward-summary";
import { useActivityDay } from "@/hooks/use-activity-day";
import { useI18n, type TKey } from "@/lib/i18n";
import { useGamification } from "@/hooks/use-gamification";
import { useMe } from "@/hooks/use-me";
import { useTrainingFeatures } from "@/hooks/use-training-features";
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
  ): {
    section?: "journey" | "shop" | "community" | "activity" | undefined;
    community?: "pods" | "friends" | "challenges" | "leaderboard" | undefined;
  } => ({
    section: pageSection(raw["section"], ["journey", "shop", "community", "activity"], "journey"),
    community: pageSection(
      raw["community"],
      ["pods", "friends", "challenges", "leaderboard"],
      "pods",
    ),
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
  const community = search.community ?? "pods";
  const [shopSearch, setShopSearch] = useState("");
  const [affordable, setAffordable] = useState(false),
    [available, setAvailable] = useState(false);
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data: g } = useGamification(user.id);
  const { data: features } = useTrainingFeatures(user.id);
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

  const {
    data: badges,
    isPending: badgesPending,
    error: badgeError,
    refetch: retryBadges,
  } = useQuery({
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
  const today = useActivityDay();
  const ws = weekStart(today);
  const {
    data: board,
    isPending: boardPending,
    error: boardError,
    refetch: retryBoard,
  } = useQuery({
    queryKey: ["leaderboard", ws],
    enabled: section === "community" && community === "leaderboard",
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
  const filteredRewards = data?.rewards.filter(
    (r) =>
      (!shopSearch.trim() ||
        title(r).toLocaleLowerCase().includes(shopSearch.trim().toLocaleLowerCase())) &&
      (!affordable || (!!g && r.cost_pv <= g.pv)) &&
      (!available || r.stock === null || r.stock > 0),
  );

  return (
    <>
      <PageHeader title={t("rewards")} eyebrow="PRIME VANGUARD" eyebrowTone="accent" />
      <RewardSummary data={g} compact={section !== "journey"} />
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
          <details className="mt-4 rounded-lg bg-card px-4">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
              {l("XP earning rules", "قواعد كسب نقاط الخبرة")}
            </summary>
            <div className="pb-4">
              <XpGuide />
            </div>
          </details>
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
          <MemberSections
            label={l("Community destinations", "وجهات المجتمع")}
            value={community}
            appearance="segmented"
            items={[
              ["pods", l("Pods", "المجموعات")],
              ...(features?.social
                ? [
                    ["friends", l("Friends", "الأصدقاء")] as const,
                    ["challenges", l("Challenges", "التحديات")] as const,
                  ]
                : []),
              ["leaderboard", t("leaderboard")],
            ]}
            onSelect={(community) =>
              void navigate({
                search: {
                  section: "community",
                  community: community === "pods" ? undefined : community,
                },
              })
            }
          />
          <div hidden={community !== "pods"}>
            <PodCommunity userId={user.id} active={community === "pods"} />
          </div>
          <div hidden={community !== "friends" && community !== "challenges"}>
            <SocialPanel
              userId={user.id}
              view={community === "challenges" ? "challenges" : "friends"}
              active={community === "friends" || community === "challenges"}
            />
          </div>
          {!features?.social && (community === "friends" || community === "challenges") && (
            <p role="status" className="mt-4 text-sm">
              {l(
                "Social availability could not be confirmed. Choose Pods or reconnect.",
                "تعذر تأكيد إتاحة الميزات الاجتماعية. اختر المجموعات أو أعد الاتصال.",
              )}
            </p>
          )}
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
                  <div className="mt-3 flex flex-wrap gap-2">
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
          <section
            id="community-leaderboard"
            hidden={community !== "leaderboard"}
            className="mt-6 scroll-mt-24 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Trophy className="h-5 w-5 text-gold" />
                {t("leaderboard")}
              </h2>
              <label className="flex items-center gap-2 text-sm">
                <Switch disabled={!me} checked={optedIn} onCheckedChange={setOptIn} />
                {t("showMe")}
              </label>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("lbHint")}</p>
            {boardPending && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                {l("Loading weekly leaderboard…", "جارٍ تحميل الصدارة الأسبوعية…")}
              </p>
            )}
            {boardError && (
              <p role="alert" className="mt-3 text-sm">
                {l("Leaderboard unavailable.", "الصدارة غير متاحة.")}{" "}
                <Button variant="outline" onClick={() => void retryBoard()}>
                  {l("Retry leaderboard", "إعادة تحميل الصدارة")}
                </Button>
              </p>
            )}
            {rows.length === 0 && !boardPending && !boardError ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("lbEmpty")}</p>
            ) : (
              <ol className="mt-3 space-y-2 text-sm">
                {rows.map((r, i) => (
                  <li
                    key={r.member_id}
                    className={`flex items-center justify-between gap-3 rounded-lg bg-background p-3 ${r.member_id === user.id ? "font-semibold text-gold" : ""}`}
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
                {badges ? `${badges.filter((b) => b.unlockedAt).length}/${badges.length}` : "—"}
              </span>
            </h2>
            {badgesPending && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                {l("Loading badges…", "جارٍ تحميل الأوسمة…")}
              </p>
            )}
            {badgeError && (
              <p role="alert" className="mt-3 text-sm">
                {l("Badges unavailable.", "الأوسمة غير متاحة.")}{" "}
                <Button variant="outline" onClick={() => void retryBadges()}>
                  {l("Retry badges", "إعادة تحميل الأوسمة")}
                </Button>
              </p>
            )}
            {badges?.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {l("No badges are available yet.", "لا توجد أوسمة متاحة بعد.")}
              </p>
            )}
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {badges?.map((b) => (
                <li
                  key={b.code}
                  className={`flex items-start gap-3 rounded-lg border p-4 ${b.unlockedAt ? "border-gold/40 bg-background" : "border-border bg-background text-muted-foreground"}`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-card ${b.unlockedAt ? "text-gold" : "text-muted-foreground"}`}
                  >
                    {b.unlockedAt ? <Award className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
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
                  </div>
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
            <div className="mt-4 space-y-2">
              <label className="block text-sm">
                {l("Find a reward", "البحث عن مكافأة")}
                <Input
                  className="mt-1"
                  value={shopSearch}
                  onChange={(event) => setShopSearch(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={affordable}
                    disabled={!g}
                    onChange={(e) => setAffordable(e.target.checked)}
                  />
                  {l("Within my PV balance", "ضمن رصيدي من PV")}
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={available}
                    onChange={(e) => setAvailable(e.target.checked)}
                  />
                  {l("In stock", "متاح")}
                </label>
              </div>
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {filteredRewards?.map((r) => {
                const out = r.stock !== null && r.stock <= 0;
                const poor = !!g && g.pv < r.cost_pv;
                return (
                  <li
                    key={r.id}
                    className="flex min-w-0 flex-col justify-between gap-4 rounded-xl bg-background p-4"
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
                      variant="secondary"
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
            {data && filteredRewards?.length === 0 && data.rewards.length > 0 && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                {l("No rewards match these filters.", "لا توجد مكافآت تطابق هذه الفلاتر.")}{" "}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShopSearch("");
                    setAffordable(false);
                    setAvailable(false);
                  }}
                >
                  {l("Clear reward filters", "مسح فلاتر المكافآت")}
                </Button>
              </p>
            )}
            {!!data?.reds.length && (
              <>
                <h3 className="mt-5 text-sm font-semibold">{t("myRedemptions")}</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {data.reds.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-background p-3"
                    >
                      <div>
                        <p>
                          {title(r.rewards)} ·{" "}
                          <span className="tabular-nums text-muted-foreground">{r.cost_pv} PV</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <time dateTime={r.created_at}>
                            {new Date(r.created_at).toLocaleDateString(
                              locale === "ar" ? "ar-EG" : "en-GB",
                              { timeZone: "Africa/Cairo" },
                            )}
                          </time>
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
                  <li
                    key={x.id}
                    className="flex flex-wrap justify-between gap-3 rounded-lg bg-background p-3"
                  >
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
