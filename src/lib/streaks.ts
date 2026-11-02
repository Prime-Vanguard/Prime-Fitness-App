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

export type Quest = {
  key: "q_workouts" | "q_nutrition" | "q_body";
  progress: number;
  goal: number;
};
export function weeklyQuests(a: {
  workouts: number;
  foodDays: number;
  bodyChecks: number;
}): Quest[] {
  return [
    { key: "q_workouts", progress: Math.min(a.workouts, 3), goal: 3 },
    { key: "q_nutrition", progress: Math.min(a.foodDays, 5), goal: 5 },
    { key: "q_body", progress: Math.min(a.bodyChecks, 1), goal: 1 },
  ];
}
