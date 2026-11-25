import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemberData } from "@/hooks/use-member-data";
import { syncMemberEntries, watchMemberSync } from "@/lib/member-store";
import { MemberSyncPanel } from "./member-sync-panel";
import { syncWorkout } from "@/lib/workout-sync";
import type { Workout } from "@/lib/workout-store";
import { syncCardio } from "@/features/cardio/store";
import { syncProfileSettings } from "@/lib/offline-profile-settings";
import { reportError } from "@/lib/sentry";
import { OfflineSyncOverview } from "./offline-sync-overview";
import { clearQueuedSyncDelay } from "@/lib/queued-sync-access";

const MEMBER_QUERY_KEYS = ["nutrition", "body", "wellness", "saved-meals", "today", "gamification"];

type MemberSyncProps = {
  userId: string;
  recordsEnabled?: boolean;
  workoutsEnabled?: boolean;
  cardioEnabled?: boolean;
  settingsEnabled?: boolean;
  overview?: boolean;
  workout?: Workout | null;
};

export function MemberSync(props: MemberSyncProps) {
  return <MemberSyncAccount key={props.userId} {...props} />;
}
// Scope subscriptions to the signed-in account and refresh after accepted changes.
function MemberSyncAccount({
  userId,
  recordsEnabled = true,
  workoutsEnabled = false,
  cardioEnabled = false,
  settingsEnabled = false,
  overview = false,
  workout,
}: MemberSyncProps) {
  const { state, error } = useMemberData(userId);
  const qc = useQueryClient();
  const historyRemovalId = state.references?.["offlineHistoryRemovalId"];
  useEffect(() => {
    if (typeof historyRemovalId !== "string") return;
    for (const key of ["sessions", "linked-workout", "workout-history-detail"])
      void qc.invalidateQueries({ queryKey: [key, userId] });
  }, [historyRemovalId, qc, userId]);
  const workoutFailures = useRef(0);
  // Read the flags at call time. They settle as profile and feature data load;
  // rebuilding the timers on each change would start a burst of extra syncs.
  const enabled = useRef({ recordsEnabled, workoutsEnabled, cardioEnabled, settingsEnabled });
  enabled.current = { recordsEnabled, workoutsEnabled, cardioEnabled, settingsEnabled };
  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const { recordsEnabled, workoutsEnabled, cardioEnabled, settingsEnabled } = enabled.current;
    const tasks: Promise<unknown>[] = [];
    if (recordsEnabled) tasks.push(syncMemberEntries(userId));
    if (cardioEnabled) tasks.push(syncCardio(userId));
    if (settingsEnabled)
      tasks.push(
        syncProfileSettings(userId).then(async (changed) => {
          if (changed) await qc.invalidateQueries({ queryKey: ["me", userId] });
        }),
      );
    if (workoutsEnabled)
      tasks.push(
        syncWorkout(userId).then(
          () => {
            workoutFailures.current = 0;
          },
          (failure: unknown) => {
            workoutFailures.current += 1;
            if (workoutFailures.current === 4)
              reportError(failure, { area: "workout-sync", code: "retries-exhausted", count: 4 });
            throw failure;
          },
        ),
      );
    // Each store owns request ordering and its cross-tab lock. A slow domain
    // must not delay the start of another domain's retry.
    const results = await Promise.allSettled(tasks);
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }, [userId, qc]);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!alive || !enabled.current.recordsEnabled || !navigator.onLine) return;
      for (const key of MEMBER_QUERY_KEYS) void qc.invalidateQueries({ queryKey: [key, userId] });
    };
    const retry = () => {
      void sync().catch(() => {});
    };
    const foregroundRetry = () => {
      if (document.visibilityState !== "hidden") retry();
    };
    const resume = () => {
      retry();
      refresh();
    };
    const reconnect = () => {
      clearQueuedSyncDelay(userId);
      resume();
    };
    retry();
    const timer = setInterval(foregroundRetry, 15000);
    const remoteTimer = setInterval(() => {
      if (document.visibilityState !== "hidden") refresh();
    }, 60000);
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", foregroundRetry);
    return () => {
      alive = false;
      clearInterval(timer);
      clearInterval(remoteTimer);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", foregroundRetry);
    };
  }, [userId, qc, sync]);
  // Preferences turn on once the profile loads, after the first sync on mount.
  // Sync them then instead of waiting for the next timer (for example right after sign-in).
  useEffect(() => {
    if (!settingsEnabled || !navigator.onLine) return;
    void syncProfileSettings(userId)
      .then(async (changed) => {
        if (changed) await qc.invalidateQueries({ queryKey: ["me", userId] });
      })
      .catch(() => {});
  }, [settingsEnabled, userId, qc]);
  useEffect(() => {
    if (!recordsEnabled) return;
    // A notice can arrive after this account's effect is gone; ignore it then.
    let alive = true;
    const stop = watchMemberSync(userId, () => {
      if (!alive || !navigator.onLine) return;
      for (const key of MEMBER_QUERY_KEYS) void qc.invalidateQueries({ queryKey: [key, userId] });
    });
    return () => {
      alive = false;
      stop();
    };
  }, [userId, qc, recordsEnabled]);
  const otherQueues = overview ? (
    <OfflineSyncOverview state={state} error={error} workout={workout ?? null} />
  ) : undefined;
  return overview || recordsEnabled ? (
    <MemberSyncPanel
      userId={userId}
      state={state}
      error={error}
      overview={otherQueues}
      retryQueues={overview ? sync : undefined}
    />
  ) : null;
}
