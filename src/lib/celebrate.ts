import { useSyncExternalStore } from "react";

/** Server-confirmed moments, played one at a time (docs/gamification-plan.md, Phase 2). */
export type Celebration =
  | { kind: "rank"; level: number; rank: string }
  | { kind: "level"; level: number }
  | { kind: "badge"; code: string; title: string }
  | { kind: "quest"; key: string }
  | { kind: "streak"; days: number }
  | { kind: "xp"; amount: number }
  | { kind: "redeem"; id: string };

export type CelebrationLevel = "full" | "subtle" | "off";

const PRIORITY: Record<Celebration["kind"], number> = {
  rank: 0,
  level: 1,
  badge: 2,
  quest: 3,
  streak: 4,
  xp: 5,
  redeem: 6,
};
/** Kinds small enough to play during a workout: at most 400ms, no overlay, no focus change. */
const SMALL = new Set<Celebration["kind"]>(["xp"]);

// Level and rank share one slot: a rank-up already shows the new level.
const slot = (e: Celebration) =>
  e.kind === "level" || e.kind === "rank"
    ? "stage"
    : e.kind === "badge"
      ? `badge:${e.code}`
      : e.kind === "quest"
        ? `quest:${e.key}`
        : e.kind === "redeem"
          ? `redeem:${e.id}`
          : e.kind;

function merge(old: Celebration, next: Celebration): Celebration {
  if (old.kind === "xp" && next.kind === "xp")
    return { kind: "xp", amount: old.amount + next.amount };
  if (
    (old.kind === "level" || old.kind === "rank") &&
    (next.kind === "level" || next.kind === "rank")
  ) {
    const level = Math.max(old.level, next.level);
    const rank = next.kind === "rank" ? next.rank : old.kind === "rank" ? old.rank : null;
    return rank ? { kind: "rank", level, rank } : { kind: "level", level };
  }
  return next;
}

/** Add an event: duplicates merge (levels keep the highest, XP adds up), then order by priority. */
export function enqueue(queue: readonly Celebration[], event: Celebration): Celebration[] {
  const at = queue.findIndex((e) => slot(e) === slot(event));
  const next = at < 0 ? [...queue, event] : queue.map((e, i) => (i === at ? merge(e, event) : e));
  return next.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);
}

/** The event to play now; during a workout big moments wait for the debrief. */
export function nextToPlay(queue: readonly Celebration[], inWorkout: boolean) {
  return inWorkout ? queue.find((e) => SMALL.has(e.kind)) : queue[0];
}

export function celebrationLevel(): CelebrationLevel {
  try {
    const saved = localStorage.getItem("pf-celebrations");
    if (saved === "full" || saved === "subtle" || saved === "off") return saved;
    return matchMedia("(prefers-reduced-motion: reduce)").matches ? "subtle" : "full";
  } catch {
    return "subtle";
  }
}

let queue: Celebration[] = [];
let workouts = 0;
let snapshot: { current: Celebration | undefined; level: CelebrationLevel } | undefined;
const listeners = new Set<() => void>();
function emit() {
  snapshot = { current: nextToPlay(queue, workouts > 0), level: celebrationLevel() };
  for (const listener of listeners) listener();
}

export function celebrate(event: Celebration) {
  queue = enqueue(queue, event);
  emit();
}
/** Finish the event on stage (tap, Escape, timeout) so the next one can play. */
export function celebrationDone(event: Celebration) {
  queue = queue.filter((e) => e !== event);
  emit();
}
/** Mark a workout in progress; returns the release function for effect cleanup. */
export function holdForWorkout() {
  workouts++;
  emit();
  return () => {
    workouts--;
    emit();
  };
}
export function setCelebrationLevel(level: CelebrationLevel) {
  try {
    localStorage.setItem("pf-celebrations", level);
  } catch {
    /* The setting falls back to the device's motion preference. */
  }
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const server = { current: undefined, level: "subtle" as CelebrationLevel } as const;
export const useCelebration = () =>
  useSyncExternalStore(
    subscribe,
    () => (snapshot ??= { current: nextToPlay(queue, workouts > 0), level: celebrationLevel() }),
    () => server,
  );
