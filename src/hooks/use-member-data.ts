import { useEffect, useState } from "react";
import {
  emptyMemberState,
  readMemberState,
  changeMemberState,
  watchMemberState,
  syncMemberEntries,
  type MemberEntity,
  type MemberRecord,
  cacheMemberRecords,
  beginMemberRead,
} from "@/lib/member-store";
import { activityDay, addDays } from "@/lib/dates";
export function useMemberData(userId: string) {
  const [state, setState] = useState(emptyMemberState);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const read = () =>
      void readMemberState(userId)
        .then((s) => {
          if (alive) {
            setState(s);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(String(e.message));
        });
    void changeMemberState(userId, (s) => {
      const cutoff = addDays(activityDay(), -6);
      const records = { ...s.records };
      for (const entity of [
        "food_logs",
        "water_logs",
        "body_measurements",
        "wellness_checkins",
      ] as const) {
        const pending = new Set(s.queue.filter((m) => m.entity === entity).map((m) => m.record_id));
        records[entity] = (records[entity] ?? []).filter(
          (r) => pending.has(r.id) || String(r.log_date ?? r.measured_on ?? "") >= cutoff,
        );
      }
      return { ...s, records };
    })
      .then(read)
      .catch((e) => {
        if (alive) setError(String(e.message));
      });
    const stop = watchMemberState(read);
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      alive = false;
      stop();
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, [userId]);
  return { state, error, retry: () => syncMemberEntries(userId) };
}
export { beginMemberRead };
export async function retainMemberRows(
  userId: string,
  entity: MemberEntity,
  rows: unknown[],
  token: Awaited<ReturnType<typeof beginMemberRead>>,
) {
  return cacheMemberRecords(userId, entity, rows as MemberRecord[], token);
}
