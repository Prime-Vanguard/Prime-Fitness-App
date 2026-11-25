import { offlineHistoryStart } from "@/lib/offline-window";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { activityDay } from "./dates";
import { personalHistoryCoverage } from "./history-download-range";
import {
  authorizeQueuedSync,
  clearQueuedSyncDelay,
  delayQueuedSync,
  queuedSyncAuthorization,
  isRetryableSyncFailure,
} from "./queued-sync-access";
export type MemberEntity =
  "food_logs" | "water_logs" | "body_measurements" | "wellness_checkins" | "saved_meals";
export type MemberRecord = Record<string, Json | undefined> & {
  id: string;
  revision?: number;
  member_id?: string;
  log_date?: string;
  measured_on?: string;
  sleep_hours?: number | null;
  energy?: number | null;
  soreness?: number | null;
  notes?: string | null;
};
export type MemberMutation = {
  id: string;
  record_id: string;
  entity: MemberEntity;
  op: "put" | "delete";
  payload: MemberRecord;
  base_revision: number;
  group: string;
  status: "queued" | "sending" | "conflict" | "rejected";
  error?: string | undefined;
  server?: MemberRecord | null | undefined;
  server_revision?: number | undefined;
};
export type MemberState = {
  version: 1;
  cacheEpochs?: Partial<Record<MemberEntity, number>>;
  records: Partial<Record<MemberEntity, MemberRecord[]>>;
  queue: MemberMutation[];
  references: Partial<Record<string, Json>> & { schedule?: Json; targets?: Json };
  lastSync: string | null;
};
export const emptyMemberState = (): MemberState => ({
  version: 1,
  records: {},
  queue: [],
  references: {},
  lastSync: null,
});
const namespace = (user: string) => `${import.meta.env["VITE_SUPABASE_URL"]}:${user}`;
let connection: Promise<IDBDatabase> | undefined;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;
function notify() {
  for (const fn of listeners) fn();
  channel?.postMessage("change");
}
// Version 2 stores each record and reference separately so a write touches only what
// changed; "members" keeps the small per-member part (queue, epochs, lastSync).
const STORES = ["members", "member_records", "member_references"];
type StoredRow = { entity: MemberEntity; position: number; row: MemberRecord };
const scopeRange = (scope: string) => IDBKeyRange.bound([scope], [scope, []]);
// The per-member value; empty lists are named so callers still see `[]` rather than undefined.
function metaOf({ records, references: _references, ...meta }: MemberState) {
  const emptyEntities = (Object.keys(records) as MemberEntity[]).filter(
    (entity) => !records[entity]?.length,
  );
  return emptyEntities.length ? { ...meta, emptyEntities } : meta;
}
function upgradeMemberData(r: IDBOpenDBRequest, oldVersion: number) {
  const db = r.result;
  if (oldVersion < 1) db.createObjectStore("members");
  if (oldVersion >= 2) return;
  const rowStore = db.createObjectStore("member_records"),
    refStore = db.createObjectStore("member_references");
  if (oldVersion < 1) return;
  const cursor = r.transaction!.objectStore("members").openCursor();
  cursor.onsuccess = () => {
    const c = cursor.result;
    if (!c) return;
    const scope = c.key as string,
      state = c.value as MemberState;
    for (const [entity, rows] of Object.entries(state.records ?? {}))
      (rows ?? []).forEach((row, position) =>
        rowStore.put({ entity, position, row }, [scope, entity, row.id]),
      );
    for (const [name, value] of Object.entries(state.references ?? {}))
      if (value !== undefined) refStore.put(value, [scope, name]);
    c.update(metaOf({ ...state, records: state.records ?? {} }));
    c.continue();
  };
}
type LoadedState = { state: MemberState; positions: Map<string, number>; meta: unknown };
const rowKey = (entity: string, id: string) => `${entity}\u0000${id}`;
// Callback-based so the transaction stays active for the write that follows.
function loadState(tx: IDBTransaction, scope: string, onLoaded: (loaded: LoadedState) => void) {
  const range = scopeRange(scope),
    refStore = tx.objectStore("member_references"),
    meta = tx.objectStore("members").get(scope),
    rows = tx.objectStore("member_records").getAll(range),
    refKeys = refStore.getAllKeys(range),
    refValues = refStore.getAll(range);
  let pending = 4;
  const done = () => {
    if (--pending) return;
    const base = meta.result ?? emptyMemberState();
    const state: MemberState = { ...base, records: {}, references: {} };
    const positions = new Map<string, number>();
    const stored = (rows.result as StoredRow[]).sort((a, b) => a.position - b.position);
    for (const { entity, position, row } of stored) {
      (state.records[entity] ??= []).push(row);
      positions.set(rowKey(entity, row.id), position);
    }
    for (const entity of (base.emptyEntities ?? []) as MemberEntity[]) state.records[entity] ??= [];
    delete (state as { emptyEntities?: unknown }).emptyEntities;
    refKeys.result.forEach((key, i) => {
      state.references[(key as string[])[1]!] = refValues.result[i];
    });
    onLoaded({ state, positions, meta: meta.result });
  };
  for (const request of [meta, rows, refKeys, refValues]) request.onsuccess = done;
}
function writeChanges(tx: IDBTransaction, scope: string, before: LoadedState, after: MemberState) {
  const rowStore = tx.objectStore("member_records"),
    refStore = tx.objectStore("member_references");
  const entities = new Set([
    ...Object.keys(before.state.records),
    ...Object.keys(after.records),
  ] as MemberEntity[]);
  for (const entity of entities) {
    const old = new Map(
      (before.state.records[entity] ?? []).map((row) => [
        row.id,
        { position: before.positions.get(rowKey(entity, row.id))!, json: JSON.stringify(row) },
      ]),
    );
    const lowest = Math.min(0, ...[...old.values()].map((o) => o.position));
    const kept = new Set<string>();
    let last = -Infinity;
    for (const row of after.records[entity] ?? []) {
      kept.add(row.id);
      const prior = old.get(row.id);
      // Keep stored positions while list order holds; renumber only rows that moved.
      const position =
        prior && prior.position > last
          ? prior.position
          : last === -Infinity
            ? lowest - 1
            : last + 1;
      if (!prior || prior.position !== position || prior.json !== JSON.stringify(row))
        rowStore.put({ entity, position, row }, [scope, entity, row.id]);
      last = position;
    }
    for (const id of old.keys()) if (!kept.has(id)) rowStore.delete([scope, entity, id]);
  }
  for (const name of new Set([
    ...Object.keys(before.state.references),
    ...Object.keys(after.references),
  ])) {
    const value = after.references[name];
    if (value === undefined) {
      if (before.state.references[name] !== undefined) refStore.delete([scope, name]);
    } else if (JSON.stringify(value) !== JSON.stringify(before.state.references[name]))
      refStore.put(value, [scope, name]);
  }
  const meta = metaOf(after);
  if (JSON.stringify(meta) !== JSON.stringify(before.meta))
    tx.objectStore("members").put(meta, scope);
}
function database() {
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("prime-fitness-member-data", 2);
      r.onupgradeneeded = (event) => upgradeMemberData(r, event.oldVersion);
      r.onsuccess = () => {
        // Let a newer build in another tab upgrade the schema; the next call reopens.
        r.result.onversionchange = () => {
          r.result.close();
          connection = undefined;
        };
        resolve(r.result);
      };
      r.onerror = () => reject(r.error);
      r.onblocked = () =>
        reject(new Error("Close other Prime Fitness tabs to update member storage."));
    }).catch((e) => {
      connection = undefined;
      throw e;
    });
  return connection;
}
// Local member data is scoped by both backend project and member identity.
export async function readMemberState(user: string): Promise<MemberState> {
  const d = await database();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORES);
    loadState(tx, namespace(user), ({ state }) => resolve(state));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Device read interrupted."));
  });
}
// Update records and queue together, and report success only after IndexedDB commits.
export async function changeMemberState(
  user: string,
  fn: (s: MemberState) => MemberState,
): Promise<MemberState> {
  const d = await database();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORES, "readwrite"),
      scope = namespace(user);
    let value: MemberState;
    loadState(tx, scope, (loaded) => {
      try {
        // Callers may mutate the state they are given; diff against a private copy.
        const stored = structuredClone(loaded);
        const previous = loaded.state;
        const oldQueue = structuredClone(previous.queue),
          oldEpochs = { ...previous.cacheEpochs };
        value = fn(previous);
        const changed = new Set<MemberEntity>();
        const before = new Map(oldQueue.map((m) => [m.id, m]));
        const after = new Map(value.queue.map((m) => [m.id, m]));
        for (const m of [...oldQueue, ...value.queue])
          if (JSON.stringify(before.get(m.id)) !== JSON.stringify(after.get(m.id)))
            changed.add(m.entity);
        if (changed.size) {
          value = { ...value, cacheEpochs: { ...oldEpochs, ...value.cacheEpochs } };
          for (const entity of changed) value.cacheEpochs![entity] = (oldEpochs[entity] ?? 0) + 1;
        }
        writeChanges(tx, scope, stored, value);
      } catch (e) {
        tx.abort();
        reject(e);
      }
    });
    tx.oncomplete = () => {
      notify();
      resolve(value);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Device write interrupted; entry was not saved."));
  });
}
const acceptedListeners = new Map<string, Set<() => void>>();
function deliverAccepted(scope: string) {
  for (const callback of acceptedListeners.get(scope) ?? []) {
    try {
      callback();
    } catch {
      /* Cache observers cannot fail an acknowledged sync. */
    }
  }
}
function ensureMemberChannel() {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("pf-member-data");
    channel.onmessage = (event) => {
      const data = event.data;
      if (data && typeof data === "object" && data.type === "member-sync-accepted") {
        if (typeof data.scope === "string") deliverAccepted(data.scope);
        return;
      }
      for (const callback of listeners) callback();
    };
  }
}
export function watchMemberState(fn: () => void) {
  listeners.add(fn);
  ensureMemberChannel();
  return () => {
    listeners.delete(fn);
  };
}
/** Cache signal only; messages contain a project/member scope, never record data. */
export function watchMemberSync(user: string, callback: () => void) {
  const scope = namespace(user);
  const group = acceptedListeners.get(scope) ?? new Set<() => void>();
  group.add(callback);
  acceptedListeners.set(scope, group);
  ensureMemberChannel();
  return () => {
    group.delete(callback);
    if (!group.size) acceptedListeners.delete(scope);
  };
}
function notifyMemberSynced(user: string) {
  const scope = namespace(user);
  deliverAccepted(scope);
  ensureMemberChannel();
  channel?.postMessage({ type: "member-sync-accepted", scope });
}
// Group related writes under one durable identity so retries cannot split a meal.
export async function queueMemberWrites(
  user: string,
  writes: {
    entity: MemberEntity;
    op: "put" | "delete";
    record: MemberRecord;
    expectedRevision?: number;
    allowMissing?: boolean;
    requireMissing?: boolean;
  }[],
  updateReferences?: (references: MemberState["references"]) => MemberState["references"],
) {
  if (!writes.length || writes.length > 100) throw new Error("Save at most 100 entries at a time.");
  if (new Set(writes.map((w) => `${w.entity}:${w.record.id}`)).size !== writes.length)
    throw new Error("A grouped change cannot repeat a record ID.");
  const group = crypto.randomUUID();
  return changeMemberState(user, (s) => {
    const next = structuredClone(s);
    for (const { entity, op, record, expectedRevision, allowMissing, requireMissing } of writes) {
      if (record.member_id && record.member_id !== user)
        throw new Error("Record ownership mismatch.");
      const rows = next.records[entity] ?? [];
      const current = rows.find((r) => r.id === record.id);
      const prior = next.queue
        .filter((m) => m.entity === entity && m.record_id === record.id)
        .at(-1);
      if (requireMissing && current)
        throw new Error("This entry already exists. Refresh before restoring.");
      if (
        expectedRevision !== undefined &&
        ((!current && !allowMissing) || (current && current.revision !== expectedRevision))
      )
        throw new Error("This entry changed in another tab. Reopen it before saving.");
      if (
        (expectedRevision !== undefined || requireMissing) &&
        prior &&
        (prior.status === "conflict" || prior.status === "rejected")
      )
        throw new Error("Resolve this entry's synchronization issue before changing it.");
      const revision = prior
        ? prior.base_revision + 1
        : (rows.find((r) => r.id === record.id)?.revision ?? record.revision ?? 0);
      const payload = { ...record, member_id: user };
      next.queue.push({
        id: crypto.randomUUID(),
        group,
        record_id: record.id,
        entity,
        op,
        payload,
        base_revision: revision,
        status: "queued",
      });
      next.records[entity] = rows.filter((r) => r.id !== record.id);
      if (op !== "delete") next.records[entity]!.push({ ...payload, revision: revision + 1 });
    }
    if (updateReferences) next.references = updateReferences(next.references);
    return next;
  });
}
export async function beginMemberRead(user: string) {
  return (await readMemberState(user)).cacheEpochs ?? {};
}
/**
 * Merge a download into the device cache. Rows the download covers are replaced, so
 * server deletions and edits arrive. Cached rows outside it survive only while they
 * are pending, recent, or inside history the member explicitly downloaded; anything
 * else would never refresh again and would grow the store without bound.
 */
export function mergeDownloadedMemberRows(
  state: MemberState,
  entity: MemberEntity,
  downloadedRows: MemberRecord[],
  memberId: string,
  downloaded: { from: string; to?: string },
): MemberRecord[] {
  const pendingRecordIds = new Set(
    state.queue
      .filter((mutation) => mutation.entity === entity)
      .map((mutation) => mutation.record_id),
  );
  const today = activityDay();
  const retained = [
    { from: offlineHistoryStart(today), to: today },
    ...personalHistoryCoverage(state, memberId),
  ];
  const cachedRowsById = new Map((state.records[entity] ?? []).map((row) => [row.id, row]));
  const dateOf = (row: MemberRecord) => row.log_date ?? row.measured_on;
  const withinDownloadedWindow = (row: MemberRecord) => {
    const date = dateOf(row);
    return (
      typeof date !== "string" ||
      (date >= downloaded.from && (!downloaded.to || date <= downloaded.to))
    );
  };
  const withinRetainedHistory = (row: MemberRecord) => {
    const date = dateOf(row);
    return typeof date === "string" && retained.some(({ from, to }) => date >= from && date <= to);
  };
  const acceptedRows = new Map<string, MemberRecord>();
  for (const row of downloadedRows) {
    if (pendingRecordIds.has(row.id)) continue;
    if (!withinDownloadedWindow(row) && !withinRetainedHistory(row)) continue;
    const cached = cachedRowsById.get(row.id);
    acceptedRows.set(row.id, cached && (cached.revision ?? 0) > (row.revision ?? 0) ? cached : row);
  }
  for (const row of cachedRowsById.values()) {
    if (acceptedRows.has(row.id)) continue;
    if (
      pendingRecordIds.has(row.id) ||
      (!withinDownloadedWindow(row) && withinRetainedHistory(row))
    )
      acceptedRows.set(row.id, row);
  }
  return [...acceptedRows.values()];
}

export async function cacheMemberRecords(
  user: string,
  entity: MemberEntity,
  rows: MemberRecord[],
  token: Partial<Record<MemberEntity, number>>,
) {
  let accepted = false;
  await changeMemberState(user, (s) => {
    if ((s.cacheEpochs?.[entity] ?? 0) !== (token[entity] ?? 0)) return s;
    accepted = true;
    const merged = mergeDownloadedMemberRows(s, entity, rows, user, {
      from: offlineHistoryStart(activityDay()),
    });
    return {
      ...s,
      records: { ...s.records, [entity]: merged },
      lastSync: new Date().toISOString(),
    };
  });
  return accepted;
}

export async function cacheNutritionWindow(
  user: string,
  food: MemberRecord[],
  water: MemberRecord[],
  window: { from: string; to: string },
  targets: Json,
  token: Partial<Record<MemberEntity, number>>,
) {
  await changeMemberState(user, (state) => {
    const canApply = (["food_logs", "water_logs"] as const).every(
      (entity) => (state.cacheEpochs?.[entity] ?? 0) === (token[entity] ?? 0),
    );
    if (!canApply) return state;
    return {
      ...state,
      records: {
        ...state.records,
        food_logs: mergeDownloadedMemberRows(state, "food_logs", food, user, window),
        water_logs: mergeDownloadedMemberRows(state, "water_logs", water, user, window),
      },
      references: { ...state.references, foodWindow: window, targets },
      lastSync: new Date().toISOString(),
    };
  });
}
// Reuse an in-flight flush for the same member; record order and group boundaries
// are preserved even when reconnect, focus and the periodic retry overlap.
const running = new Map<string, Promise<void>>();
export function syncMemberEntries(user: string): Promise<void> {
  const old = running.get(user);
  if (old) return old;
  const flush = async () => {
    let accepted = false;
    try {
      if (!navigator.onLine) return;
      const initial = await readMemberState(user);
      if (!initial.queue.some((entry) => entry.status === "queued" || entry.status === "sending"))
        return;
      if (!(await authorizeQueuedSync(user, "records"))) return;
      for (let pass = 0; pass < 100; pass++) {
        const s = await readMemberState(user);
        const firstByRecord = new Map<string, string>();
        for (const m of s.queue) {
          const key = `${m.entity}:${m.record_id}`;
          if (!firstByRecord.has(key)) firstByRecord.set(key, m.id);
        }
        const ready = (m: MemberMutation) =>
          (m.status === "queued" || m.status === "sending") &&
          firstByRecord.get(`${m.entity}:${m.record_id}`) === m.id;
        const head = s.queue.find(
          (m) => ready(m) && s.queue.filter((q) => q.group === m.group).every(ready),
        );
        if (!head) return;
        const batch = s.queue.filter((m) => m.group === head.group);
        if (batch.some((m) => m.status === "conflict" || m.status === "rejected")) return;
        const ids = new Set(batch.map((m) => m.id));
        await changeMemberState(user, (v) => ({
          ...v,
          queue: v.queue.map((m) => (ids.has(m.id) ? { ...m, status: "sending" } : m)),
        }));
        // Recheck identity immediately before sending, including after a tab/account switch.
        const authorization = await queuedSyncAuthorization(user);
        if (!authorization) return;
        const body = batch.map(({ id, record_id, entity, op, payload, base_revision }) => ({
          id,
          record_id,
          entity,
          op,
          payload,
          base_revision,
        }));
        const { data, error, status } = await supabase
          .rpc("apply_member_mutations", { _mutations: body as Json })
          .setHeader("Authorization", authorization)
          .abortSignal(AbortSignal.timeout(15000));
        if (error) {
          const retryable = isRetryableSyncFailure(error, status);
          if (retryable) delayQueuedSync(user, "records");
          const permanent =
            !retryable &&
            ["23514", "23503", "23505", "22P02", "42501", "P0001"].includes(error.code ?? "");
          await changeMemberState(user, (v) => ({
            ...v,
            queue: v.queue.map((m) =>
              ids.has(m.id)
                ? { ...m, status: permanent ? "rejected" : "queued", error: error.message }
                : m,
            ),
          }));
          return;
        }
        const responses = data as unknown as {
          id: string;
          status: string;
          record: MemberRecord | null;
          revision: number;
        }[];
        const malformed =
          !Array.isArray(responses) ||
          responses.some(
            (r) =>
              !r ||
              !ids.has(r.id) ||
              !["applied", "already_applied", "conflict"].includes(r.status) ||
              !Number.isSafeInteger(r.revision) ||
              r.revision < 0 ||
              (r.record != null &&
                (r.record.member_id !== user || typeof r.record.id !== "string")),
          ) ||
          new Set(responses?.map?.((r) => r.id)).size !== responses?.length ||
          (!responses.some((r) => r.status === "conflict") && responses.length !== ids.size);
        if (malformed) {
          delayQueuedSync(user, "records");
          await changeMemberState(user, (v) => ({
            ...v,
            queue: v.queue.map((m) =>
              ids.has(m.id)
                ? {
                    ...m,
                    status: "queued",
                    error:
                      "Incomplete server acknowledgement. Your changes remain on this device; retry synchronization.",
                  }
                : m,
            ),
          }));
          return;
        }
        clearQueuedSyncDelay(user, "records");
        if (!Array.isArray(responses) || responses.some((r) => r.status === "conflict")) {
          await changeMemberState(user, (v) => ({
            ...v,
            queue: v.queue.map((m) => {
              if (!ids.has(m.id)) return m;
              const r = responses?.find?.((r) => r.id === m.id);
              return {
                ...m,
                status: "conflict",
                server: r?.record,
                server_revision: r?.revision,
                error: "Conflict: compare server and device versions before saving.",
              };
            }),
          }));
          return;
        }
        await changeMemberState(user, (v) => {
          const next = structuredClone(v);
          for (const result of responses) {
            const mutation = next.queue.find((m) => m.id === result.id);
            if (!mutation || !ids.has(result.id)) continue;
            next.queue = next.queue.filter((m) => m.id !== result.id);
            if (
              next.queue.some(
                (m) => m.record_id === mutation.record_id && m.entity === mutation.entity,
              )
            )
              continue;
            const records = (next.records[mutation.entity] ?? []).filter(
              (r) => r.id !== mutation.record_id,
            );
            if (result.record) records.push(result.record);
            next.records[mutation.entity] = records;
          }
          next.lastSync = new Date().toISOString();
          return next;
        });
        accepted = true;
      }
    } finally {
      // Emit once per flush, including accepted groups before a later failure.
      if (accepted) notifyMemberSynced(user);
    }
  };
  const run = Promise.resolve(
    navigator.locks ? navigator.locks.request(`pf-member-sync:${namespace(user)}`, flush) : flush(),
  )
    .then(() => {})
    .finally(() => running.delete(user));
  running.set(user, run);
  return run;
}
export async function resolveMemberConflict(
  user: string,
  id: string,
  choice: "server" | "local",
  reviewed?: MemberMutation[],
) {
  await changeMemberState(user, (s) => {
    const next = structuredClone(s);
    const m = next.queue.find((m) => m.id === id);
    if (!m) {
      if (reviewed) throw new Error("This conflict changed. Reopen the latest comparison.");
      return s;
    }
    if (
      reviewed &&
      JSON.stringify(
        next.queue.filter((q) => q.entity === m.entity && q.record_id === m.record_id),
      ) !== JSON.stringify(reviewed)
    )
      throw new Error(
        "This conflict changed. Reopen the latest comparison; your data is retained.",
      );
    if (m.status !== "conflict") throw new Error("Only server conflicts can be resolved this way.");
    if (m.server_revision == null) throw new Error("Resolve the conflicting ingredient first.");
    const latest = next.queue
      .filter((q) => q.entity === m.entity && q.record_id === m.record_id)
      .at(-1)!;
    next.queue = next.queue
      .filter((q) => q.entity !== m.entity || q.record_id !== m.record_id)
      .map((q) =>
        q.group === m.group && q.status === "conflict" && q.server_revision == null
          ? { ...q, status: "queued", error: undefined }
          : q,
      );
    next.records[m.entity] = (next.records[m.entity] ?? []).filter(
      (r) => r.id !== m.record_id && r.id !== m.server?.id,
    );
    if (choice === "server") {
      if (m.server) next.records[m.entity]!.push(m.server);
    } else {
      if (m.server_revision == null)
        throw new Error("Resolve the conflicting ingredient first, then retry this meal.");
      next.queue.push({
        ...latest,
        id: crypto.randomUUID(),
        record_id: m.server?.id ?? m.record_id,
        payload: { ...latest.payload, id: m.server?.id ?? m.record_id },
        group: m.group,
        base_revision: m.server_revision,
        status: "queued",
        error: undefined,
      });
      if (latest.op !== "delete")
        next.records[m.entity]!.push({
          ...latest.payload,
          id: m.server?.id ?? m.record_id,
          revision: m.server_revision + 1,
        });
    }
    return next;
  });
}
