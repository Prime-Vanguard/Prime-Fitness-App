import { useEffect, useRef, useState } from "react";
import { celebrationMoves } from "@/lib/celebrate";

/**
 * Shows `value`, rolling to each new value over 300ms. The first second after mount
 * counts as loading and never animates. Screen readers get only the final value.
 */
export function RollingNumber({
  value,
  format,
}: {
  value: number;
  format: (value: number) => string;
}) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  const mountedAt = useRef(performance.now());
  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    if (performance.now() - mountedAt.current < 1000 || !celebrationMoves()) {
      current.current = value;
      return void setShown(value);
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 300);
      current.current = t < 1 ? from + (value - from) * (1 - (1 - t) ** 3) : value;
      setShown(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <>
      <span aria-hidden>{format(Math.round(shown))}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
