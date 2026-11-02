import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  loadPreviousPerformance,
  readRestPreference,
  saveRestPreference,
  type PreviousContext,
} from "@/lib/workout-references";

export function usePreviousPerformance(context: PreviousContext, online: boolean) {
  return useQuery({
    queryKey: [
      "workout-previous",
      context.member,
      context.session,
      context.exercise,
      context.slot,
      context.side,
      context.mode,
      context.convention,
      online,
    ],
    enabled: !!context.exercise,
    networkMode: "always",
    retry: false,
    queryFn: () => loadPreviousPerformance(context),
  });
}
export function useSlotRest(member: string, key: string) {
  const [state, setState] = useState({ owner: "", key: "", seconds: 90, ready: false, error: "" });
  useEffect(() => {
    let alive = true;
    const saved = Number(localStorage.getItem("pf-rest-seconds"));
    const fallback = saved >= 15 && saved <= 600 ? saved : 90;
    void readRestPreference(member, key, fallback)
      .then((seconds) => {
        if (alive) setState({ owner: member, key, seconds, ready: true, error: "" });
      })
      .catch((e: Error) => {
        if (alive)
          setState({ owner: member, key, seconds: fallback, ready: true, error: e.message });
      });
    return () => {
      alive = false;
    };
  }, [member, key]);
  const active = state.owner === member && state.key === key;
  return {
    seconds: active ? state.seconds : 90,
    ready: active && state.ready,
    error: active ? state.error : "",
    save: async (seconds: number) => {
      await saveRestPreference(member, key, seconds);
      // Do not let a late acknowledgement replace another slot's preference.
      setState((s) => (s.owner === member && s.key === key ? { ...s, seconds, error: "" } : s));
    },
  };
}
