import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  changeMemberState,
  queueMemberWrites,
  readMemberState,
  type MemberRecord,
  type MemberState,
} from "./member-store";

type Entry = { id: string; member_id: string; log_date: string; revision: number };
export type EntryUndo<T> = {
  token: string;
  mode: "queued" | "online";
  status: "deleting" | "deleted";
  record: T;
};
const envelope = z.object({
  token: z.string().uuid(),
  mode: z.enum(["queued", "online"]),
  status: z.enum(["deleting", "deleted"]),
  record: z.record(z.string(), z.unknown()),
});
/** Shared revision/tombstone protocol. Each entity supplies its own validated record contract. */
export function entryRecovery<T extends Entry>(
  entity: "food_logs" | "water_logs",
  key: string,
  parse: (row: Record<string, unknown>, owner: string) => T,
  payload: (row: T) => Record<string, unknown>,
) {
  const record = (row: T): MemberRecord => ({ ...row });
  function entries(refs: MemberState["references"]): EntryUndo<T>[] {
    const rows = z
      .array(envelope)
      .max(10)
      .parse(refs[key] ?? []);
    const result = rows.map((item) => ({
      ...item,
      record: parse(item.record, String(item.record["member_id"])),
    }));
    if (
      new Set(result.map((item) => item.token)).size !== result.length ||
      new Set(result.map((item) => item.record.id)).size !== result.length
    )
      throw new Error("Duplicate recovery records. Export device data before removing it.");
    return result;
  }
  function merge(
    current: MemberState["references"],
    source: MemberState["references"],
    owner: string,
    protectedIds: Set<string>,
  ) {
    const incoming = entries(source);
    if (!incoming.length) return current;
    const merged = entries(current);
    for (const item of [...merged, ...incoming]) parse(record(item.record), owner);
    for (const item of incoming)
      if (
        !protectedIds.has(item.record.id) &&
        !merged.some((old) => old.token === item.token || old.record.id === item.record.id)
      )
        merged.push(item);
    if (merged.length > 10)
      throw new Error(
        "Restore or dismiss existing deletions before importing more recovery records.",
      );
    return { ...current, [key]: merged };
  }
  const remove = (refs: MemberState["references"], token: string) => ({
    ...refs,
    [key]: entries(refs).filter((item) => item.token !== token),
  });
  async function dismiss(owner: string, token: string) {
    await changeMemberState(owner, (state) => ({
      ...state,
      references: remove(state.references, token),
    }));
  }
  async function edit(owner: string, original: T, next: T, queued: boolean, allowMissing: boolean) {
    parse(record(original), owner);
    const validated = parse(
      {
        ...next,
        id: original.id,
        member_id: owner,
        log_date: original.log_date,
        revision: original.revision,
      },
      owner,
    );
    if (queued)
      await queueMemberWrites(owner, [
        {
          entity,
          op: "put",
          record: record(validated),
          expectedRevision: original.revision,
          allowMissing,
        },
      ]);
    else {
      const result = await supabase
        .from(entity)
        .update(payload(validated) as never)
        .eq("id", original.id)
        .eq("member_id", owner)
        .eq("revision", original.revision)
        .select("id")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data)
        throw new Error("This entry changed or is no longer writable. Refresh and reopen it.");
    }
  }
  async function finish(owner: string, undo: EntryUndo<T>) {
    const original = parse(record(undo.record), owner);
    const result = await supabase
      .from(entity)
      .delete()
      .eq("id", original.id)
      .eq("member_id", owner)
      .eq("revision", original.revision)
      .select("id");
    if (result.error) throw result.error;
    if (!result.data?.length) {
      const current = await supabase
        .from(entity)
        .select("id")
        .eq("id", original.id)
        .eq("member_id", owner)
        .maybeSingle();
      if (current.error) throw current.error;
      if (current.data)
        throw new Error("This entry changed. Refresh before retrying the deletion.");
    }
    await changeMemberState(owner, (state) => ({
      ...state,
      references: {
        ...state.references,
        [key]: entries(state.references).map((item) =>
          item.token === undo.token ? { ...item, status: "deleted" as const } : item,
        ),
      },
    }));
  }
  async function del(owner: string, original: T, queued: boolean, allowMissing: boolean) {
    const validated = parse(record(original), owner);
    const recovery: EntryUndo<T> = {
      token: crypto.randomUUID(),
      mode: queued ? "queued" : "online",
      status: queued ? "deleted" : "deleting",
      record: validated,
    };
    const append = (refs: MemberState["references"]) => {
      const prior = entries(refs);
      if (prior.length >= 10 || prior.some((item) => item.record.id === validated.id))
        throw new Error("Restore or dismiss an existing deletion before deleting this entry.");
      return { ...refs, [key]: [...prior, recovery] };
    };
    if (queued)
      await queueMemberWrites(
        owner,
        [
          {
            entity,
            op: "delete",
            record: record(validated),
            expectedRevision: validated.revision,
            allowMissing,
          },
        ],
        append,
      );
    else {
      await changeMemberState(owner, (state) => ({
        ...state,
        references: append(state.references),
      }));
      await finish(owner, recovery);
    }
  }
  async function restore(owner: string, undo: EntryUndo<T>) {
    const original = parse(record(undo.record), owner);
    if (undo.mode === "queued")
      await queueMemberWrites(
        owner,
        [
          {
            entity,
            op: "put",
            record: record({ ...original, revision: original.revision + 1 }),
            requireMissing: true,
          },
        ],
        (refs) => remove(refs, undo.token),
      );
    else {
      const restored = { ...original, revision: original.revision + 2 };
      const result = await supabase
        .from(entity)
        .insert(record(restored) as never)
        .select("id")
        .single();
      if (result.error) {
        if (result.error.code !== "23505") throw result.error;
        const current = await supabase
          .from(entity)
          .select("*")
          .eq("id", original.id)
          .eq("member_id", owner)
          .maybeSingle();
        if (current.error) throw current.error;
        if (
          !current.data ||
          Object.entries(restored).some(
            ([name, value]) =>
              String((current.data as unknown as Record<string, unknown>)[name]) !== String(value),
          )
        )
          throw new Error(
            "This entry already exists with different values. Refresh before restoring.",
          );
      } else if (!result.data)
        throw new Error("Restore was not confirmed. Retry the saved recovery.");
      await dismiss(owner, undo.token);
    }
  }
  async function allowsMissing(owner: string, id: string) {
    return !(await readMemberState(owner)).records[entity]?.some((row) => row.id === id);
  }
  return { entries, merge, dismiss, edit, finish, del, restore, allowsMissing };
}
