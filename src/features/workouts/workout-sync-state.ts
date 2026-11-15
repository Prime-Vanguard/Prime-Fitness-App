// A pending count does not tell us whether a network request is in flight.
export function workoutSyncState(online: boolean, pending: number, error: boolean) {
  if (error) return "attention";
  if (pending) return "pending";
  return online ? "synced" : "offline";
}
