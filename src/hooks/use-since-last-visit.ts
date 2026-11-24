import { useEffect, useState } from "react";

type Value = string | number;
export type SinceLastVisit = {
  /** Ids that are new or whose value changed, mapped to the value seen last visit. */
  changed: Map<string, Value | undefined>;
  /** No earlier visit was saved under this key. */
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

/**
 * Saves `entries` on this device under `key` and returns what changed since the last
 * visit. A later refetch with no changes keeps the first result, so marks stay put.
 */
export function useSinceLastVisit(key: string, entries: [string, Value][] | undefined) {
  const [result, setResult] = useState<SinceLastVisit>({ changed: new Map(), fresh: false });
  const signature = entries && JSON.stringify(entries);
  useEffect(() => {
    if (!entries) return;
    let previous: Record<string, Value> | null = null;
    try {
      previous = JSON.parse(localStorage.getItem(key) ?? "null") as Record<string, Value> | null;
      localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      return; // Without device storage there is no "last visit" to compare with.
    }
    const next = changesSince(previous, entries);
    setResult((current) => (next.changed.size || next.fresh ? next : current));
    // The signature stands in for `entries`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, signature]);
  return result;
}
