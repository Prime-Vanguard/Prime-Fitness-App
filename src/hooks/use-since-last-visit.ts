import { useEffect, useState } from "react";
import { readDeviceJson, writeDevice } from "@/lib/device-storage";

type Value = string | number;
export type SinceLastVisit = {
  /** Ids that are new or whose value changed, mapped to the value seen last visit. */
  changed: Map<string, Value | undefined>;
  /** No earlier visit was saved under this key and scope. */
  fresh: boolean;
};

/** Compares this visit's values with the saved ones. With nothing saved there are no changes. */
export function changesSince(
  previous: Record<string, Value> | null,
  entries: [string, Value][],
): SinceLastVisit {
  const changed = new Map<string, Value | undefined>();
  if (previous)
    for (const [id, value] of entries) if (previous[id] !== value) changed.set(id, previous[id]);
  return { changed, fresh: !previous };
}

/** The saved values, when they belong to the same scope (for example the same week). */
export function savedValues(saved: unknown, scope: string): Record<string, Value> | null {
  if (!saved || typeof saved !== "object") return null;
  const { scope: savedScope, values } = saved as { scope?: unknown; values?: unknown };
  return savedScope === scope && values && typeof values === "object"
    ? (values as Record<string, Value>)
    : null;
}

/**
 * Saves `entries` on this device under `key` and returns what changed since the last
 * visit. One key per use: a new `scope` (such as a new week) replaces the old values,
 * so storage never grows. A later refetch with no changes keeps the first result.
 */
export function useSinceLastVisit(key: string, entries: [string, Value][] | undefined, scope = "") {
  const [result, setResult] = useState<SinceLastVisit>({ changed: new Map(), fresh: false });
  const signature = entries && JSON.stringify(entries);
  useEffect(() => {
    if (!entries) return;
    const previous = savedValues(readDeviceJson(key), scope);
    // Without device storage there is no "last visit" to compare with.
    if (!writeDevice(key, JSON.stringify({ scope, values: Object.fromEntries(entries) }))) return;
    const next = changesSince(previous, entries);
    setResult((current) => (next.changed.size || next.fresh ? next : current));
    // The signature stands in for `entries`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, signature, scope]);
  return result;
}
