import { useEffect } from "react";
export function useWorkoutWakeLock() {
  useEffect(() => {
    if (!navigator.wakeLock) return;
    let alive = true;
    let lock: WakeLockSentinel | undefined;
    const request = async () => {
      try {
        if (lock && !lock.released) return;
        const next = await navigator.wakeLock.request("screen");
        if (alive) lock = next;
        else await next.release();
      } catch {
        /* Keeping the screen awake is optional. */
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", visible);
      void lock?.release().catch(() => {});
    };
  }, []);
}
