import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { activityDay, addDays } from "./dates";
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
function database() {
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("prime-fitness-member-data", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("members");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () =>
        reject(new Error("Close other Prime Fitness tabs to update member storage."));
    }).catch((e) => {
      connection = undefined;
      throw e;
    });
  return connection;
}
export async function readMemberState(user: string): Promise<MemberState> {
  const d = await database();
  return new Promise((resolve, reject) => {
    const r = d.transaction("members").objectStore("members").get(namespace(user));
    r.onsuccess = () => resolve(r.result ?? emptyMemberState());
    r.onerror = () => reject(r.error);
  });
}
export async function changeMemberState(
  user: string,
  fn: (s: MemberState) => MemberState,
): Promise<MemberState> {
  const d = await database();
  return new Promise((resolve, reject) => {
    const tx = d.transaction("members", "readwrite"),
      store = tx.objectStore("members"),
      r = store.get(namespace(user));
    let value: MemberState;
    r.onsuccess = () => {
      try {
        const previous: MemberState = r.result ?? emptyMemberState();
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
        store.put(value, namespace(user));
      } catch (e) {
        tx.abort();
        reject(e);
      }
    };
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
    const pending = new Set(s.queue.filter((m) => m.entity === entity).map((m) => m.record_id));
    const cutoff = addDays(activityDay(), -6);
    const currentById = new Map((s.records[entity] ?? []).map((r) => [r.id, r]));
    const keep = (s.records[entity] ?? []).filter((r) => pending.has(r.id));
    const merged = [
      ...rows
        .filter(
          (r) =>
            !pending.has(r.id) &&
            ((!r.log_date && !r.measured_on) || String(r.log_date ?? r.measured_on) >= cutoff),
        )
        .map((row) => {
          const current = currentById.get(row.id);
          return current && (current.revision ?? 0) > (row.revision ?? 0) ? current : row;
        }),
      ...keep,
    ];
    return {
      ...s,
      records: { ...s.records, [entity]: merged },
      lastSync: new Date().toISOString(),
    };
  });
  return accepted;
}
const running = new Map<string, Promise<void>>();
export function syncMemberEntries(user: string): Promise<void> {
  const old = running.get(user);
  if (old) return old;
  const flush = async () => {
    let accepted = false;
    try {
      if (!navigator.onLine) return;
      const auth = await supabase.auth.getSession();
      if (auth.data.session?.user.id !== user) return;
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
        const current = await supabase.auth.getSession();
        if (current.data.session?.user.id !== user) return;
        const body = batch.map(({ id, record_id, entity, op, payload, base_revision }) => ({
          id,
          record_id,
          entity,
          op,
          payload,
          base_revision,
        }));
        const { data, error } = await supabase
          .rpc("apply_member_mutations", { _mutations: body as Json })
          .abortSignal(AbortSignal.timeout(15000));
        if (error) {
          const permanent = ["23514", "23503", "23505", "22P02", "42501", "P0001"].includes(
            error.code ?? "",
          );
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
