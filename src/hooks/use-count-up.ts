import { useEffect, useState } from "react";
import { celebrationLevel } from "@/lib/celebrate";

/** True when celebrations should move: the Full setting and no reduced-motion request. */
export function celebrationMoves() {
  try {
    return celebrationLevel() === "full" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Counts from `from` to `to` once on mount (ease-out). Shows `to` at once when motion is
 * calm, when `animate` is false, or when there is no time to count.
 */
export function useCountUp(to: number, ms = 900, from = 0, delay = 0, animate = true) {
  const moves = () => animate && ms > 0 && celebrationMoves();
  const [value, setValue] = useState(() => (moves() ? from : to));
  useEffect(() => {
    if (!moves()) return void setValue(to);
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      setValue(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, ms, from, delay, animate]);
  return value;
}
