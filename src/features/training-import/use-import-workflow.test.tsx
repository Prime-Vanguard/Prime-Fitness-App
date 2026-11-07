import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { parseTrainingCsv } from "@/lib/training-import";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ locale: "en" }) }));
vi.mock("@/lib/member-store", () => ({
  readMemberState: vi.fn().mockResolvedValue({ references: {} }),
  changeMemberState: vi.fn(),
}));
vi.mock("./use-import-review", () => ({
  useImportReview: () => ({
    exercises: [{ id: "bench", name_en: "Bench Press", name_ar: null }],
    exercisesError: null,
    historyReview: { isPending: false, error: null },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), auth: { getSession: vi.fn() } },
}));
import { useImportWorkflow } from "./use-import-workflow";
class ParserWorker {
  static instances: ParserWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    ParserWorker.instances.push(this);
  }
}
const csv =
  "Date,Workout Name,Exercise Name,Set Order,Weight,Reps\n2026-10-20 10:00:00,Test,Bench Press,1,40,10";
const options = {
  provider: "strong" as const,
  units: "kg" as const,
  timeZone: "Africa/Cairo",
  ambiguity: "reject" as const,
};
const rows = () => parseTrainingCsv(csv, options);
const file = () => ({ name: "strong.csv", size: csv.length, text: async () => csv }) as File;
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useImportWorkflow("member", true), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}
beforeEach(() => {
  ParserWorker.instances = [];
  vi.stubGlobal("Worker", ParserWorker);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("advances a parsed Strong file to mapping without importing it", async () => {
  const { result } = setup();
  await act(() => result.current.parse(file()));
  expect(result.current.busy).toBe(true);
  await act(async () =>
    ParserWorker.instances[0]!.onmessage?.({ data: { workouts: rows() } } as MessageEvent),
  );
  expect(result.current.step).toBe(2);
  expect(result.current.mapping).toEqual({ "Bench Press": "bench" });
  expect(result.current.busy).toBe(false);
  expect(result.current.attempted).toBe(false);
});
it("stops an unresponsive worker, allows reselection and ignores stale results", async () => {
  vi.useFakeTimers();
  const { result } = setup();
  await act(() => result.current.parse(file()));
  const old = ParserWorker.instances[0]!;
  act(() => vi.advanceTimersByTime(120000));
  expect(result.current.busy).toBe(false);
  expect(result.current.error).toContain("stopped responding");
  expect(old.terminate).toHaveBeenCalled();
  await act(() => result.current.parse(file()));
  act(() => old.onmessage?.({ data: { workouts: rows() } } as MessageEvent));
  expect(result.current.step).toBe(1);
  await act(async () =>
    ParserWorker.instances[1]!.onmessage?.({ data: { workouts: rows() } } as MessageEvent),
  );
  expect(result.current.step).toBe(2);
  expect(result.current.error).toBe("");
});
it("recovers from worker message errors and explains unsupported-only files", async () => {
  const { result } = setup();
  await act(() => result.current.parse(file()));
  act(() => ParserWorker.instances[0]!.onmessageerror?.());
  expect(result.current.busy).toBe(false);
  expect(result.current.error).toContain("unreadable result");
  await act(() => result.current.parse(file()));
  act(() =>
    ParserWorker.instances[1]!.onmessage?.({
      data: { workouts: [{ ...rows()[0], sets: [] }] },
    } as MessageEvent),
  );
  expect(result.current.step).toBe(1);
  expect(result.current.error).toContain("No supported strength or timed sets");
  expect(result.current.busy).toBe(false);
});
it("cancels a pending file read before a worker starts", async () => {
  const { result } = setup();
  let resolve!: (text: string) => void;
  const pending = {
    ...file(),
    text: () =>
      new Promise<string>((r) => {
        resolve = r;
      }),
  } as File;
  let parse!: Promise<void>;
  act(() => {
    parse = result.current.parse(pending);
  });
  act(() => result.current.cancelParsing());
  await act(async () => {
    resolve(csv);
    await parse;
  });
  expect(ParserWorker.instances).toHaveLength(0);
  expect(result.current.busy).toBe(false);
  expect(result.current.step).toBe(1);
});
