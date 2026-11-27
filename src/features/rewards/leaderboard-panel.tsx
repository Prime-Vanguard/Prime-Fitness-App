import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useActivityDay } from "@/hooks/use-activity-day";
import { useMe } from "@/hooks/use-me";
import { useSinceLastVisit } from "@/hooks/use-since-last-visit";
import { useI18n } from "@/lib/i18n";
import { numberLocale } from "@/lib/number-locale";
import { weekStart } from "@/lib/streaks";

/** Weekly leaderboard with the opt-in switch and places moved since the last visit. */
export function LeaderboardPanel({ userId, active }: { userId: string; active: boolean }) {
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const qc = useQueryClient();
  const { data: me } = useMe(userId);
  const today = useActivityDay();
  const ws = weekStart(today);
  const optedIn = !!me?.profile?.leaderboard_opt_in;
  const {
    data: board,
    isPending: boardPending,
    error: boardError,
    refetch: retryBoard,
  } = useQuery({
    queryKey: ["leaderboard", ws, optedIn],
    enabled: active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaderboard_weekly")
        .select("member_id,xp,display_name,opted_in")
        .eq("week_start", ws)
        .order("xp", { ascending: false })
        .limit(50);
      if (error) throw error;
      if (data.some((r) => r.member_id === userId)) return data;
      // The top 50 can miss the member, so fetch their own row as well.
      const own = await supabase
        .from("leaderboard_weekly")
        .select("member_id,xp,display_name,opted_in")
        .eq("week_start", ws)
        .eq("member_id", userId)
        .maybeSingle();
      if (own.error) throw own.error;
      if (data.length < 50) return own.data ? [...data, own.data] : data;
      // Only an opted-in member's own row is listed, so skip the count otherwise.
      if (!optedIn) return data;
      // Outside the top 50: position = 1 + opted-in members with more XP (RLS shows only those).
      const ahead = await supabase
        .from("leaderboard_weekly")
        .select("member_id", { count: "exact", head: true })
        .eq("week_start", ws)
        .eq("opted_in", true)
        .neq("member_id", userId)
        .gt("xp", own.data?.xp ?? 0);
      // Ties with the 50th row still list below it, so never show a place inside the top 50.
      // A failed count keeps the board and falls back to "50+".
      const rank = ahead.error || ahead.count == null ? undefined : Math.max(51, ahead.count + 1);
      const row = own.data ?? {
        member_id: userId,
        xp: 0,
        display_name: null,
        opted_in: false,
      };
      return [...data, { ...row, outside: true, rank }];
    },
  });
  async function setOptIn(v: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ leaderboard_opt_in: v })
      .eq("id", userId);
    if (error)
      return void toast.error(
        l(
          "Could not change your leaderboard setting. Check your connection and try again.",
          "تعذر تغيير إعداد لوحة الصدارة. تحقق من الاتصال وحاول مرة أخرى.",
        ),
      );
    qc.invalidateQueries({ queryKey: ["me", userId] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
  }
  const listed: {
    member_id: string;
    xp: number;
    display_name: string | null;
    outside?: boolean;
    rank?: number | undefined;
  }[] = (board ?? []).filter((r) => r.opted_in || (optedIn && r.member_id === userId));
  // Opted-in members always see themselves, even before earning XP this week.
  const rows =
    optedIn && board && !listed.some((r) => r.member_id === userId)
      ? [...listed, { member_id: userId, xp: 0, display_name: null }]
      : listed;
  const number = (n: number) => n.toLocaleString(numberLocale(locale));
  // Places gained or lost since this device last showed this week's board.
  const places = useSinceLastVisit(
    `pf-board-${userId}`,
    board ? rows.filter((r) => !r.outside).map((r, i) => [r.member_id, i + 1]) : undefined,
    ws,
  );

  return (
    <section
      id="community-leaderboard"
      hidden={!active}
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
              className={`flex items-center justify-between gap-3 rounded-lg bg-background p-3 ${places.fresh ? "board-in" : ""} ${r.member_id === userId ? "font-semibold text-gold" : ""}`}
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`min-w-6 text-center tabular-nums ${i < 3 && !r.outside ? "text-gold" : "text-muted-foreground"}`}
                >
                  {r.outside ? (r.rank ? number(r.rank) : "50+") : i + 1}
                </span>
                {r.member_id === userId ? t("you") : r.display_name || "—"}
                {(() => {
                  const before = places.changed.get(r.member_id);
                  if (r.outside || typeof before !== "number" || before === i + 1) return null;
                  const up = before > i + 1;
                  const moved = Math.abs(before - (i + 1));
                  const label = up
                    ? l(`Up ${moved} since your last visit`, `تقدم ${moved} منذ زيارتك الأخيرة`)
                    : l(`Down ${moved} since your last visit`, `تراجع ${moved} منذ زيارتك الأخيرة`);
                  const Arrow = up ? ArrowUp : ArrowDown;
                  return (
                    <span
                      role="img"
                      aria-label={label}
                      title={label}
                      className={`flex items-center text-xs tabular-nums ${up ? "text-success" : "text-muted-foreground"}`}
                    >
                      <Arrow aria-hidden className="size-3" />
                      {number(moved)}
                    </span>
                  );
                })()}
              </span>
              <bdi className="tabular-nums">
                {number(r.xp)} {t("xp")}
              </bdi>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
