import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemberData } from "@/hooks/use-member-data";
import { syncMemberEntries, watchMemberSync } from "@/lib/member-store";
import { MemberSyncPanel } from "./member-sync-panel";
export function MemberSync({ userId }: { userId: string }) {
  return <MemberSyncAccount key={userId} userId={userId} />;
}
function MemberSyncAccount({ userId }: { userId: string }) {
  const { state, error } = useMemberData(userId);
  const qc = useQueryClient();
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!alive || !navigator.onLine) return;
      for (const key of ["nutrition", "body", "wellness", "saved-meals", "today", "gamification"])
        void qc.invalidateQueries({ queryKey: [key, userId] });
    };
    const sync = () => {
      void syncMemberEntries(userId).catch(() => {});
    };
    const resume = () => {
      sync();
      refresh();
    };
    const stop = watchMemberSync(userId, refresh);
    sync();
    const timer = setInterval(sync, 15000);
    const remoteTimer = setInterval(() => {
      if (document.visibilityState !== "hidden") refresh();
    }, 60000);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    return () => {
      alive = false;
      clearInterval(timer);
      clearInterval(remoteTimer);
      stop();
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
    };
  }, [userId, qc]);
  return <MemberSyncPanel userId={userId} state={state} error={error} />;
}
