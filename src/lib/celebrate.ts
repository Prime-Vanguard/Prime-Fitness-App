import { useSyncExternalStore } from "react";
import { readDevice, readDeviceJson, writeDevice } from "./device-storage";

/** Server-confirmed moments, played one at a time (docs/gamification-plan.md, Phase 2). */
export type Celebration =
  // from: the level last seen on this device, so several levels at once can roll.
  | { kind: "rank"; level: number; rank: string; from: number }
  | { kind: "level"; level: number; from: number }
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
    const level = Math.max(old.level, next.level),
      from = Math.min(old.from, next.from);
    const rank = next.kind === "rank" ? next.rank : old.kind === "rank" ? old.rank : null;
    return rank ? { kind: "rank", level, rank, from } : { kind: "level", level, from };
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
  const saved = readDevice("pf-celebrations");
  if (saved === "full" || saved === "subtle" || saved === "off") return saved;
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches ? "subtle" : "full";
  } catch {
    return "subtle";
  }
}

let queue: Celebration[] = [];
let workouts = 0;
// The signed-in member whose Rewards dot the navigation shows.
let rewardsUser: string | null = null;
type Snapshot = { current: Celebration | undefined; level: CelebrationLevel; rewardsNew: boolean };
let snapshot: Snapshot | undefined;
const read = (): Snapshot => ({
  current: nextToPlay(queue, workouts > 0),
  level: celebrationLevel(),
  rewardsNew: rewardsUser != null && readDevice(`pf-rewards-new-${rewardsUser}`) === "1",
});
const listeners = new Set<() => void>();
function emit() {
  snapshot = read();
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
  // Without storage the setting falls back to the device's motion preference.
  writeDevice("pf-celebrations", level);
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const server: Snapshot = { current: undefined, level: "subtle", rewardsNew: false };

/** Rewards tab dot, per member: set when a badge is earned, cleared when Rewards is opened. */
export function setRewardsNew(userId: string, value: boolean) {
  const key = `pf-rewards-new-${userId}`;
  if ((readDevice(key) === "1") === value) return;
  writeDevice(key, value ? "1" : "0");
  emit();
}
export function setRewardsUser(userId: string | null) {
  if (rewardsUser === userId) return;
  rewardsUser = userId;
  emit();
}
export const useCelebration = () =>
  useSyncExternalStore(
    subscribe,
    () => (snapshot ??= read()),
    () => server,
  );

/**
 * The latest workout's debrief facts for this tab: confirmed XP when it opened, the gain
 * frozen on first display, and whether the debrief has played. One record, so nothing piles up.
 */
type Debrief = { id: string; start: number; gain?: number; shown?: boolean };
const DEBRIEF_KEY = "pf-workout-debrief";
export function debriefRecord(sessionId: string): Debrief | null {
  const value = readDeviceJson(DEBRIEF_KEY, "session") as Debrief | null;
  return value?.id === sessionId ? value : null;
}
function writeDebrief(value: Debrief) {
  // Without storage the debrief simply shows no XP delta.
  writeDevice(DEBRIEF_KEY, JSON.stringify(value), "session");
}
export function rememberStartXp(sessionId: string, xp: number) {
  // The first value wins: a refetch mid-workout may already include this workout's XP.
  if (!debriefRecord(sessionId)) writeDebrief({ id: sessionId, start: xp });
}
export function updateDebrief(sessionId: string, patch: Partial<Omit<Debrief, "id">>) {
  const current = debriefRecord(sessionId);
  if (current) writeDebrief({ ...current, ...patch });
}

/** True when celebrations should move: the Full setting and no reduced-motion request. */
export function celebrationMoves() {
  try {
    return celebrationLevel() === "full" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
