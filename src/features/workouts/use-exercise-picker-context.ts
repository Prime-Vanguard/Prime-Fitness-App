import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { watchMemberState } from "@/lib/member-store";
import { deviceScope } from "@/lib/device-scope";
import {
  loadPickerHistory,
  readPickerPreferences,
  setPickerFavorite,
} from "./exercise-picker-store";

/** Mount only while the picker is open. Query and device keys include the member
 * and project; late results from another identity cannot replace this view. */
export function useExercisePickerContext(member: string) {
  const qc = useQueryClient();
  const scope = deviceScope(member);
  const key = ["exercise-picker-preferences", scope];
  const preferences = useQuery({
    queryKey: key,
    queryFn: () => readPickerPreferences(member),
    networkMode: "always",
  });
  const history = useQuery({
    queryKey: ["exercise-picker-history", scope],
    queryFn: ({ signal }) => loadPickerHistory(member, signal),
    networkMode: "always",
    staleTime: 60000,
    retry: false,
  });
  const [saving, setSaving] = useState(false);
  useEffect(
    () =>
      watchMemberState(() => {
        void qc.invalidateQueries({ queryKey: ["exercise-picker-preferences", scope] });
      }),
    [qc, scope],
  );
  return {
    preferences,
    history,
    saving,
    favorite: async (id: string, desired: boolean) => {
      setSaving(true);
      try {
        await setPickerFavorite(member, id, desired);
        await qc.invalidateQueries({ queryKey: key });
      } finally {
        setSaving(false);
      }
    },
  };
}
