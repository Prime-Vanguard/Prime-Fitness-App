import { z } from "zod";
import { readMemberState, changeMemberState } from "@/lib/member-store";
import { deviceScope } from "@/lib/device-scope";
import { activityDay, addDays } from "@/lib/dates";
import { supabase } from "@/integrations/supabase/client";
import { featureCall } from "@/features/experience/api";
import type { Json } from "@/integrations/supabase/types";
import {
  cardioData,
  cardioRecord,
  intervalTimer,
  intervalTotal,
  timerElapsed,
  type CardioData,
  type CardioRecord,
  type IntervalTimer,
} from "./model";
const operation = z.object({
  id: z.string().uuid(),
  record_id: z.string().uuid(),
  expected: z.number().int().min(0),
  data: cardioData.nullable(),
  status: z.enum(["queued", "conflict", "rejected"]),
  error: z.string().optional(),
  server: cardioRecord.nullable().optional(),
  server_revision: z.number().optional(),
});
const schema = z.object({
  records: z.array(cardioRecord).default([]),
  queue: z.array(operation).default([]),
  timer: intervalTimer.nullable().default(null),
  lastSync: z.string().nullable().default(null),
});
export type CardioState = z.output<typeof schema>;
export function cardioState(references: Partial<Record<string, Json>>) {
  return schema.parse(references["cardioState"] ?? {});
}
export function mergeCardioRecovery(
  current: Partial<Record<string, Json>>,
  source: Partial<Record<string, Json>>,
  owner: string,
) {
  if (!current["cardioState"] && !source["cardioState"]) return current;
  const local = cardioState(current),
    backup = cardioState(source);
  for (const state of [local, backup]) {
    if (
      state.records.some((r) => r.member_id !== owner) ||
      state.queue.some(
        (q) =>
          !state.records.some((r) => r.id === q.record_id) ||
          (q.server && q.server.member_id !== owner),
      )
    )
      throw new Error("Invalid cardio recovery ownership");
    if (
      new Set(state.queue.map((q) => q.id)).size !== state.queue.length ||
      new Set(state.records.map((r) => r.id)).size !== state.records.length
    )
      throw new Error("Duplicate cardio recovery identity");
  }
  const protectedIds = new Set(local.records.map((r) => r.id));
  return {
    ...current,
    cardioState: {
      ...local,
      records: [...local.records, ...backup.records.filter((r) => !protectedIds.has(r.id))],
      queue: [...local.queue, ...backup.queue.filter((q) => !protectedIds.has(q.record_id))],
      timer: local.timer ?? backup.timer,
    } as unknown as Json,
  };
}
async function change(user: string, fn: (state: CardioState) => CardioState) {
  return changeMemberState(user, (current) => ({
    ...current,
    references: {
      ...current.references,
      cardioState: fn(cardioState(current.references)) as unknown as Json,
    },
  }));
}
export async function saveCardio(
  user: string,
  data: CardioData | null,
  id: string = crypto.randomUUID(),
  expected?: number,
) {
  if (data) cardioData.parse(data);
  if (data && data.log_date > activityDay()) throw new Error("Cannot log future cardio");
  await change(user, (state) => {
    const old = state.records.find((r) => r.id === id),
      revision = old?.revision ?? 0;
    if (old && old.member_id !== user) throw new Error("Cardio ownership mismatch");
    if (expected !== undefined && revision !== expected)
      throw new Error("This cardio record changed. Reopen before editing.");
    if (state.queue.some((q) => q.record_id === id && q.status !== "queued"))
      throw new Error("Resolve this record's sync issue first.");
    const record = data
      ? { ...data, id, member_id: user, revision: revision + 1, deleted_at: null }
      : old
        ? { ...old, revision: revision + 1, deleted_at: new Date().toISOString() }
        : null;
    if (!record) throw new Error("Cardio record missing");
    return {
      ...state,
      records: [...state.records.filter((r) => r.id !== id), record],
      queue: [
        ...state.queue,
        { id: crypto.randomUUID(), record_id: id, expected: revision, data, status: "queued" },
      ],
    };
  });
  void syncCardio(user);
  return id;
}
export async function saveIntervalTimer(
  user: string,
  timer: IntervalTimer | null,
  expectedId?: string,
  expected?: IntervalTimer,
) {
  await change(user, (state) => {
    if (state.timer && !state.timer.saved && state.timer.id !== (expectedId ?? timer?.id))
      throw new Error("Another interval session is already open. Review it first.");
    if (expected && JSON.stringify(state.timer) !== JSON.stringify(intervalTimer.parse(expected)))
      throw new Error("The interval timer changed in another tab. Review it first.");
    return { ...state, timer: timer ? intervalTimer.parse(timer) : null };
  });
}
export async function completeIntervalTimer(user: string, expected: IntervalTimer) {
  await change(user, (state) => {
    if (state.timer?.id === expected.id && state.timer.saved) return state;
    if (
      !state.timer ||
      JSON.stringify(state.timer) !== JSON.stringify(intervalTimer.parse(expected))
    )
      throw new Error("The interval timer changed. Review it first.");
    if (timerElapsed(state.timer) < intervalTotal(state.timer.plan))
      throw new Error("Complete the intervals before saving");
    if (state.records.some((r) => r.id === expected.id))
      throw new Error("Interval record already exists. Review history before retrying.");
    const data = cardioData.parse({
      activity: "hiit",
      log_date: expected.log_date,
      duration_seconds: intervalTotal(expected.plan),
      intervals: expected.plan,
    });
    return {
      ...state,
      timer: { ...state.timer, saved: true, anchor: null, elapsed: data.duration_seconds },
      records: [
        ...state.records,
        { ...data, id: expected.id, member_id: user, revision: 1, deleted_at: null },
      ],
      queue: [
        ...state.queue,
        { id: crypto.randomUUID(), record_id: expected.id, expected: 0, data, status: "queued" },
      ],
    };
  });
  void syncCardio(user);
}
export async function cacheCardio(user: string, rows: CardioRecord[]) {
  const safe = z.array(cardioRecord).parse(rows);
  if (safe.some((r) => r.member_id !== user)) throw new Error("Cardio ownership mismatch");
  await change(user, (state) => {
    const pending = new Set(state.queue.map((q) => q.record_id));
    const records = new Map(state.records.map((r) => [r.id, r]));
    for (const row of safe)
      if (!pending.has(row.id) && row.revision >= (records.get(row.id)?.revision ?? 0))
        records.set(row.id, row);
    return {
      ...state,
      records: [...records.values()].filter(
        (r) => r.log_date >= addDays(activityDay(), -6) || pending.has(r.id),
      ),
      lastSync: new Date().toISOString(),
    };
  });
}
export async function resolveCardio(user: string, id: string, local: boolean) {
  await change(user, (state) => {
    const op = state.queue.find((q) => q.id === id);
    if (!op) return state;
    const latest = state.records.find((r) => r.id === op.record_id);
    const rest = state.queue.filter((q) => q.record_id !== op.record_id);
    const records = state.records.filter((r) => r.id !== op.record_id);
    if (!local)
      return { ...state, records: op.server ? [...records, op.server] : records, queue: rest };
    if (!latest) throw new Error("Local recovery record missing");
    const data = latest.deleted_at ? null : cardioData.parse(latest);
    return {
      ...state,
      records: [...records, { ...latest, revision: (op.server_revision ?? 0) + 1 }],
      queue: [
        ...rest,
        {
          id: crypto.randomUUID(),
          record_id: latest.id,
          expected: op.server_revision ?? 0,
          data,
          status: "queued",
        },
      ],
    };
  });
}
const flights = new Map<string, Promise<void>>();
export async function syncCardio(user: string) {
  const scope = deviceScope(user);
  if (flights.has(scope)) return flights.get(scope);
  const flush = async () => {
    for (let n = 0; n < 100 && navigator.onLine; n++) {
      const state = cardioState((await readMemberState(user)).references);
      const op = state.queue.find(
        (candidate, index, all) =>
          candidate.status === "queued" &&
          !all.slice(0, index).some((prior) => prior.record_id === candidate.record_id),
      );
      if (!op) return;
      const auth = await supabase.auth.getSession();
      if (auth.data.session?.user.id !== user) return;
      try {
        const result = await featureCall(
          "save_cardio_log",
          {
            _id: op.record_id,
            _expected: op.expected,
            _mutation: op.id,
            _data: op.data as unknown as Json,
          },
          (value) =>
            z
              .object({
                status: z.enum(["applied", "conflict"]),
                record: cardioRecord.nullable(),
                revision: z.number().int().min(0),
              })
              .parse(value),
        );
        if (result.record && result.record.member_id !== user)
          throw new Error("Cardio ownership mismatch");
        await change(user, (current) => {
          const pending = current.queue.find((q) => q.id === op.id);
          if (!pending) return current;
          if (result.status === "conflict")
            return {
              ...current,
              queue: current.queue.map((q) =>
                q.id === op.id
                  ? {
                      ...q,
                      status: "conflict",
                      server: result.record,
                      server_revision: result.revision,
                      error: "Changed on another device. Review both versions.",
                    }
                  : q,
              ),
            };
          const more = current.queue.some((q) => q.record_id === op.record_id && q.id !== op.id);
          return {
            ...current,
            records:
              !more && result.record
                ? [...current.records.filter((r) => r.id !== op.record_id), result.record]
                : current.records,
            queue: current.queue.filter((q) => q.id !== op.id),
            lastSync: new Date().toISOString(),
          };
        });
      } catch (error) {
        const message = (error as Error).message;
        await change(user, (current) => ({
          ...current,
          queue: current.queue.map((q) =>
            q.id === op.id
              ? {
                  ...q,
                  error: message,
                  status: /active|access|ownership|valid|constraint|out of range|disabled/i.test(
                    message,
                  )
                    ? "rejected"
                    : "queued",
                }
              : q,
          ),
        }));
        return;
      }
    }
  };
  const promise = Promise.resolve(
    navigator.locks ? navigator.locks.request(`cardio:${scope}`, flush) : flush(),
  )
    .catch(() => {})
    .finally(() => flights.delete(scope));
  flights.set(scope, promise);
  return promise;
}
export async function retryCardio(user: string) {
  await change(user, (state) => ({
    ...state,
    queue: state.queue.map((q) => (q.status === "rejected" ? { ...q, status: "queued" } : q)),
  }));
  await syncCardio(user);
}
export async function fetchCardio(
  user: string,
  from = addDays(activityDay(), -89),
  to = activityDay(),
) {
  const rows = await featureCall("get_cardio_history", { _from: from, _to: to }, (value) =>
    z.array(cardioRecord).parse(value),
  );
  await cacheCardio(user, rows);
  return rows;
}
export function mergeCardioHistory(remote: CardioRecord[], local: CardioState) {
  const result = new Map(remote.map((r) => [r.id, r]));
  const pending = new Set(local.queue.map((q) => q.record_id));
  for (const row of local.records)
    if (pending.has(row.id) || row.revision >= (result.get(row.id)?.revision ?? 0))
      result.set(row.id, row);
  return [...result.values()]
    .filter((r) => !r.deleted_at)
    .sort((a, b) => b.log_date.localeCompare(a.log_date));
}
