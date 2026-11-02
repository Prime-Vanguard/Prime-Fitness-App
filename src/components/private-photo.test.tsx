import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ locale: "en" }) }));
import { PrivatePhoto } from "./private-photo";
it("renews a failed signed URL once and offers manual retry without a renewal loop", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    renew = vi.fn();
  try {
    act(() =>
      root.render(<PrivatePhoto url="expired-url" alt="Private progress" onRenew={renew} />),
    );
    act(() => host.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(renew).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="alert"]')).toBeVisible();
    act(() => root.render(<PrivatePhoto url="new-url" alt="Private progress" onRenew={renew} />));
    act(() => host.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(renew).toHaveBeenCalledTimes(1);
    act(() => host.querySelector("button")!.click());
    expect(renew).toHaveBeenCalledTimes(2);
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
