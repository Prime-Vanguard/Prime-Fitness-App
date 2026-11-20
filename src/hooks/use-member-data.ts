import { useEffect, useState } from "react";
import {
  emptyMemberState,
  readMemberState,
  watchMemberState,
  syncMemberEntries,
  type MemberEntity,
  type MemberRecord,
  cacheMemberRecords,
  beginMemberRead,
} from "@/lib/member-store";
// Observe device data without pruning explicitly downloaded history or pending work.
export function useMemberData(userId: string) {
  const [snapshot, setSnapshot] = useState(() => ({
    memberId: userId,
    state: emptyMemberState(),
    error: "",
  }));
  useEffect(() => {
    let alive = true;
    const read = () =>
      void readMemberState(userId)
        .then((s) => {
          if (alive) {
            setSnapshot({ memberId: userId, state: s, error: "" });
          }
        })
        .catch((e) => {
          if (alive)
            setSnapshot((previous) => ({
              memberId: userId,
              state: previous.memberId === userId ? previous.state : emptyMemberState(),
              error: String(e.message),
            }));
        });
    read();
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
  return {
    state: snapshot.memberId === userId ? snapshot.state : emptyMemberState(),
    error: snapshot.memberId === userId ? snapshot.error : "",
    retry: () => syncMemberEntries(userId),
  };
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
