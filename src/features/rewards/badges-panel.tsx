import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { BadgeArt } from "@/components/badge-art";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { badgeArt, badgeProgress, RARITY_LABEL, type Rarity } from "@/lib/badges";
import { useI18n } from "@/lib/i18n";
import { numberLocale } from "@/lib/number-locale";

const RARITY_TEXT: Record<Rarity, string> = {
  common: "text-muted-foreground",
  uncommon: "text-[#d4925a]",
  rare: "text-info",
  epic: "text-[#c4a5ff]",
  legendary: "text-gold",
  mythic: "text-gold",
};

/** Badge grid with rarity artwork and a detail sheet. */
export function BadgesPanel({ userId }: { userId: string }) {
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [badge, setBadge] = useState<string | null>(null);
  const {
    data: badges,
    isPending: badgesPending,
    error: badgeError,
    refetch: retryBadges,
  } = useQuery({
    queryKey: ["badges", userId],
    queryFn: async () => {
      const [all, mine, counted] = await Promise.all([
        supabase.from("badges").select("*").order("position"),
        supabase.from("member_badges").select("badge_code,unlocked_at").eq("member_id", userId),
        supabase.from("member_activity_credits").select("kind,credits").eq("member_id", userId),
      ]);
      if (all.error) throw all.error;
      if (mine.error) throw mine.error;
      const got = new Map(mine.data.map((m) => [m.badge_code, m.unlocked_at]));
      // Progress is a hint; badges still load if the counts are unavailable.
      const credits = new Map(
        (counted.data ?? []).map((c) => [c.kind ?? "", c.credits ?? 0] as const),
      );
      return all.data.map((b) => {
        const unlockedAt = got.get(b.code) ?? null;
        return { ...b, unlockedAt, progress: unlockedAt ? null : badgeProgress(b.code, credits) };
      });
    },
  });
  return (
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
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges?.map((b) => {
            const rarity = badgeArt(b.code).rarity;
            return (
              <li key={b.code}>
                <button
                  className="flex h-full w-full flex-col items-center gap-2 rounded-xl bg-background px-2 py-4 text-center transition-colors hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-gold"
                  onClick={() => setBadge(b.code)}
                >
                  <BadgeArt code={b.code} unlocked={!!b.unlockedAt} size={72} />
                  <span
                    className={`text-sm font-semibold ${b.unlockedAt ? "" : "text-muted-foreground"}`}
                  >
                    {locale === "ar" ? b.title_ar : b.title_en}
                  </span>
                  <span className={`text-xs ${RARITY_TEXT[rarity]}`}>
                    {RARITY_LABEL[rarity][locale === "ar" ? 1 : 0]}
                  </span>
                  {b.progress && <BadgeProgress {...b.progress} />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <Sheet open={!!badge} onOpenChange={(open) => !open && setBadge(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl p-6">
          {(() => {
            const b = badges?.find((x) => x.code === badge);
            if (!b) return null;
            const rarity = badgeArt(b.code).rarity;
            return (
              <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
                <BadgeArt code={b.code} unlocked={!!b.unlockedAt} size={168} />
                <SheetTitle className="font-display text-xl">
                  {locale === "ar" ? b.title_ar : b.title_en}
                </SheetTitle>
                <p className={`text-sm font-semibold ${RARITY_TEXT[rarity]}`}>
                  {RARITY_LABEL[rarity][locale === "ar" ? 1 : 0]}
                </p>
                <SheetDescription>
                  {locale === "ar" ? b.description_ar : b.description_en}
                </SheetDescription>
                {b.progress && (
                  <div className="w-full max-w-60">
                    <BadgeProgress {...b.progress} />
                  </div>
                )}
                <p className="text-sm tabular-nums text-gold">
                  {b.unlockedAt
                    ? `${l("Earned", "حصلت عليه")} ${new Date(b.unlockedAt).toLocaleDateString(
                        locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
                        {
                          timeZone: "Africa/Cairo",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        },
                      )}`
                    : `${l("Unlock to earn", "افتحه لتحصل على")} +${b.xp_bonus.toLocaleString(numberLocale(locale))} ${t("xp")}`}
                </p>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Locked milestone progress, for example 12 / 50; spans keep it valid inside a button. */
function BadgeProgress({ done, goal }: { done: number; goal: number }) {
  const { locale } = useI18n();
  const n = (v: number) => v.toLocaleString(numberLocale(locale));
  return (
    <span className="block w-full space-y-1">
      <span aria-hidden className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-gold"
          style={{ width: `${(done / goal) * 100}%` }}
        />
      </span>
      <span className="block text-xs tabular-nums text-muted-foreground">
        {n(done)} / {n(goal)}
      </span>
    </span>
  );
}
