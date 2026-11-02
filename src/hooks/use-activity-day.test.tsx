import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useActivityDay } from "./use-activity-day";
it("updates an open screen after Cairo midnight", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-25T20:59:59Z"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  function Clock() {
    return <span>{useActivityDay()}</span>;
  }
  try {
    await act(async () => root.render(<Clock />));
    expect(container.textContent).toBe("2026-10-25");
    await act(async () => vi.advanceTimersByTime(16000));
    expect(container.textContent).toBe("2026-10-26");
  } finally {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
