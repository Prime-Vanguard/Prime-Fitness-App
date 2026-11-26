/** Dates are local YYYY-MM-DD strings. */
const shift = (d: string, n: number) => {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Consecutive active days ending today; if today isn't logged yet, the streak still counts through yesterday. */
export function currentStreak(activeDays: Iterable<string>, today: string) {
  const set = new Set(activeDays);
  let d = set.has(today) ? today : shift(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = shift(d, -1);
  }
  return n;
}

/** Monday of the week containing `today`. */
export function weekStart(today: string) {
  const x = new Date(today + "T12:00:00Z");
  const dow = (x.getUTCDay() + 6) % 7;
  return shift(today, -dow);
}

/** One row of `my_weekly_quests()`: the server's count of rewarded activity this week. */
export type QuestRow = {
  quest: string;
  progress: number;
  goal: number;
  xp: number;
  awarded: boolean;
  pays: boolean;
};
export type Quest = {
  key: "q_workouts" | "q_nutrition" | "q_body";
  progress: number;
  goal: number;
  /** Quest reward, when quests pay this week. */
  xp?: number | undefined;
  awarded: boolean;
};
const questNames = { q_workouts: "workouts", q_nutrition: "nutrition", q_body: "body" } as const;

// Local counts include entries still waiting to sync; the server counts only rewarded
// activity. Show the higher of the two so pending work is visible before it is confirmed.
export function weeklyQuests(
  a: { workouts: number; foodDays: number; bodyChecks: number },
  server?: QuestRow[],
): Quest[] {
  const local = { q_workouts: a.workouts, q_nutrition: a.foodDays, q_body: a.bodyChecks };
  const fallback = { q_workouts: 3, q_nutrition: 5, q_body: 1 };
  return (Object.keys(questNames) as Quest["key"][]).map((key) => {
    const row = server?.find((r) => r.quest === questNames[key]);
    const goal = row?.goal ?? fallback[key];
    return {
      key,
      goal,
      progress: Math.min(Math.max(local[key], row?.progress ?? 0), goal),
      xp: row?.pays ? row.xp : undefined,
      awarded: !!row?.awarded,
    };
  });
}

/** The all-quests bonus, when quests pay this week. */
export function questCampaign(server?: (QuestRow & { week_start?: string })[]) {
  const row = server?.find((r) => r.quest === "week");
  return row?.pays ? { xp: row.xp, awarded: row.awarded, week: row.week_start } : undefined;
}

/**
 * The "Campaign complete" moment plays once per week on this device, and only for a bonus
 * the server has paid. `seenWeek` is the last week it played here.
 */
export function campaignToPlay(
  campaign: ReturnType<typeof questCampaign>,
  seenWeek: string | null,
) {
  return !!campaign?.awarded && !!campaign.week && campaign.week !== seenWeek;
}

/** Flame tier: 0 none, 1 ember (1–2 days), 2 flame (3–6), 3 gold (7–13), 4 white-gold (14–29), 5 crowned (30+). */
export function streakTier(days: number) {
  return days >= 30 ? 5 : days >= 14 ? 4 : days >= 7 ? 3 : days >= 3 ? 2 : days >= 1 ? 1 : 0;
}
