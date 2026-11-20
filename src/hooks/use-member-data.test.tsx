import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMemberData } from "./use-member-data";
import { changeMemberState, readMemberState } from "@/lib/member-store";

it("never renders the previous member's records when the account changes", async () => {
  const firstMember = crypto.randomUUID();
  const secondMember = crypto.randomUUID();
  await changeMemberState(firstMember, (state) => ({
    ...state,
    records: { water_logs: [{ id: "private-record" }] },
  }));
  const observed: { memberId: string; recordIds: string[] }[] = [];
  const { result, rerender, unmount } = renderHook(
    ({ memberId }) => {
      const data = useMemberData(memberId);
      observed.push({
        memberId,
        recordIds: (data.state.records.water_logs ?? []).map((row) => row.id),
      });
      return data;
    },
    { initialProps: { memberId: firstMember } },
  );
  await waitFor(() => expect(result.current.state.records.water_logs).toHaveLength(1));
  rerender({ memberId: secondMember });
  expect(
    observed
      .filter((snapshot) => snapshot.memberId === secondMember)
      .every((snapshot) => snapshot.recordIds.length === 0),
  ).toBe(true);
  unmount();
});
it("does not prune downloaded history when mounting an observer", async () => {
  const memberId = crypto.randomUUID();
  await changeMemberState(memberId, (state) => ({
    ...state,
    records: { water_logs: [{ id: "older-download", log_date: "2000-01-01" }] },
  }));
  const { result, unmount } = renderHook(() => useMemberData(memberId));
  await waitFor(() => expect(result.current.state.records.water_logs).toHaveLength(1));
  expect((await readMemberState(memberId)).records.water_logs).toHaveLength(1);
  unmount();
});
