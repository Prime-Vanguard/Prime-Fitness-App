import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prepareOfflineWorkspace } from "@/lib/offline-workspace-preparation";

export function AutomaticOfflinePreparation({
  memberId,
  enabled,
  completionId,
}: {
  memberId: string;
  enabled: boolean;
  completionId?: string | undefined;
}) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    const prepare = () => {
      if (disposed || document.visibilityState === "hidden" || !navigator.onLine) return;
      void prepareOfflineWorkspace(memberId)
        .then((downloaded) => {
          if (disposed || !downloaded) return;
          for (const key of [
            "my-program",
            "training-schedule",
            "sessions",
            "linked-workout",
            "workout-history-detail",
          ])
            void queryClient.invalidateQueries({ queryKey: [key, memberId] });
        })
        .catch(() => {
          /* The durable attempt state supplies the recovery message. */
        });
    };
    // Yield to the initial screen and its critical profile/feature reads.
    const startup = window.setTimeout(prepare, 2000);
    const fallback = window.setInterval(prepare, 300_000);
    window.addEventListener("online", prepare);
    window.addEventListener("focus", prepare);
    document.addEventListener("visibilitychange", prepare);
    return () => {
      disposed = true;
      clearTimeout(startup);
      clearInterval(fallback);
      window.removeEventListener("online", prepare);
      window.removeEventListener("focus", prepare);
      document.removeEventListener("visibilitychange", prepare);
    };
  }, [enabled, memberId, queryClient, completionId]);
  return null;
}
