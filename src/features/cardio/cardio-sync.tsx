import { useEffect } from "react";
import { syncCardio } from "./store";
export function CardioSync({ userId }: { userId: string }) {
  useEffect(() => {
    let alive = true;
    const flush = () => {
      if (alive) void syncCardio(userId);
    };
    flush();
    const timer = setInterval(flush, 15000);
    window.addEventListener("online", flush);
    window.addEventListener("focus", flush);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("online", flush);
      window.removeEventListener("focus", flush);
    };
  }, [userId]);
  return null;
}
