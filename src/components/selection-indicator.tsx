import { useEffect, useRef } from "react";

/** Decorative only: selection, focus and persistence stay owned by the controls.
 * Measure real button bounds so wrapped/scrolling labels work in either direction. */
export function SelectionIndicator({ underline = false }: { underline?: boolean }) {
  const indicator = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = indicator.current;
    const root = element?.parentElement;
    if (!element || !root) return;
    let frame = 0;
    let disposed = false;
    const update = () => {
      frame = 0;
      const selected = root.querySelector<HTMLElement>(
        ":scope > button[aria-pressed='true'], :scope > [role='tab'][data-state='active'], :scope > [role='radio'][aria-checked='true'], :scope > label:has(input[type='radio']:checked)",
      );
      if (!selected || !selected.getClientRects().length || !root.getClientRects().length) {
        element.removeAttribute("data-ready");
        return;
      }
      const box = selected.getBoundingClientRect();
      const parent = root.getBoundingClientRect();
      // Rectangles include CSS zoom/ancestor scaling; inline positions use layout pixels.
      const scaleX = parent.width / root.offsetWidth || 1;
      const scaleY = parent.height / root.offsetHeight || 1;
      const height = box.height / scaleY;
      const x = (box.left - parent.left) / scaleX + root.scrollLeft - root.clientLeft;
      const y = (box.top - parent.top) / scaleY + root.scrollTop - root.clientTop;
      element.style.width = `${box.width / scaleX}px`;
      element.style.height = `${underline ? 2 : height}px`;
      element.style.transform = `translate3d(${x}px, ${y + (underline ? height - 2 : 0)}px, 0)`;
      element.dataset["ready"] = "true";
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(update);
    };
    // Changes are coalesced; no polling or React state update per animation frame.
    const resize = new ResizeObserver(schedule);
    const observeSizes = () => {
      resize.disconnect();
      resize.observe(root);
      for (const child of root.children) if (child !== element) resize.observe(child);
    };
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => record.type === "childList")) observeSizes();
      schedule();
    });
    observeSizes();
    mutations.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "aria-pressed",
        "aria-selected",
        "aria-checked",
        "data-state",
        "dir",
        "hidden",
      ],
    });
    // Font loading and language direction may change bounds without a selection change.
    const direction = new MutationObserver(schedule);
    direction.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dir", "lang"],
    });
    // Native radio selection is a property change rather than an attribute mutation.
    root.addEventListener("change", schedule);
    void document.fonts.ready.then(schedule);
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      direction.disconnect();
      root.removeEventListener("change", schedule);
    };
  }, [underline]);
  return (
    <span
      ref={indicator}
      aria-hidden="true"
      data-section-slider
      className={underline ? "selection-indicator selection-indicator-line" : "selection-indicator"}
    />
  );
}
