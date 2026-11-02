import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/personal-backup", () => ({
  createPersonalBackup: vi.fn(),
  downloadBackup: vi.fn(),
  projectHost: () => "test.invalid",
  RESTORE_TABLES: [],
  restorePersonalBackup: vi.fn(),
  validateBackup: vi.fn(),
  verifyMedia: vi.fn(),
}));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ locale: "en", setLocale: vi.fn() }) }));
import { createPersonalBackup, downloadBackup } from "@/lib/personal-backup";
import { BackupRestore } from "./backup-restore";

it.each(["unmount", "switch"])("does not publish an old account backup after %s", async (mode) => {
  let finish!: (value: unknown) => void;
  vi.mocked(createPersonalBackup).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }) as never,
  );
  const client = new QueryClient();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <BackupRestore userId="old-account" />
      </QueryClientProvider>,
    );
  });
  const button = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Download full backup (JSON)",
  )!;
  await act(async () => {
    button.click();
  });
  await act(async () => {
    if (mode === "unmount") root.unmount();
    else
      root.render(
        <QueryClientProvider client={client}>
          <BackupRestore userId="new-account" />
        </QueryClientProvider>,
      );
  });
  await act(async () => {
    finish({ ownerId: "old-account" });
  });
  expect(downloadBackup).not.toHaveBeenCalled();
  if (mode === "switch") await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});
