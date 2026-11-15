import { useEffect, useRef } from "react";

/** Highlight changed persisted records, never the initial read or a different scope.
 * Callers supply saved state, not editable form values. No timers or list movement. */
export function useRecordFeedback<T extends HTMLElement = HTMLDivElement>(
  scope: string,
  records: readonly { id: string; value: string }[] | undefined,
) {
  const ref = useRef<T>(null);
  const previous = useRef<{ scope: string; values: Map<string, string> } | null>(null);
  const snapshot = records ? JSON.stringify(records) : null;
  useEffect(() => {
    if (!snapshot) return;
    const saved = JSON.parse(snapshot) as { id: string; value: string }[];
    const values = new Map(saved.map((record) => [record.id, record.value]));
    const prior = previous.current;
    previous.current = { scope, values };
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    if (!prior || prior.scope !== scope || reducedMotion.matches) return;
    const animations: Animation[] = [];
    ref.current?.querySelectorAll<HTMLElement>("[data-feedback-record]").forEach((element) => {
      const id = element.dataset["feedbackRecord"]!;
      if (values.has(id) && prior.values.get(id) !== values.get(id)) {
        animations.push(
          element.animate(
            [
              { boxShadow: "inset 0 0 0 1px #34d39999" },
              { boxShadow: "inset 0 0 0 1px transparent" },
            ],
            { duration: 650, easing: "ease-out" },
          ),
        );
      }
    });
    const cancel = () => animations.forEach((animation) => animation.cancel());
    reducedMotion.addEventListener("change", cancel);
    return () => {
      cancel();
      reducedMotion.removeEventListener("change", cancel);
    };
  }, [scope, snapshot]);
  return ref;
}
