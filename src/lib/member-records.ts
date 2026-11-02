/** Preserve complete online history while overlaying every durable pending edit/deletion. */
export function overlayPendingRecords<T extends { id: string }>(
  remote: T[],
  cached: T[],
  pending: { record_id: string }[],
): T[] {
  const ids = new Set(pending.map((m) => m.record_id));
  return [...remote.filter((r) => !ids.has(r.id)), ...cached.filter((r) => ids.has(r.id))];
}
