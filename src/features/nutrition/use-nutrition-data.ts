import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemberData, retainMemberRows, beginMemberRead } from "@/hooks/use-member-data";
import { changeMemberState } from "@/lib/member-store";
import { pendingNutritionRows } from "@/lib/nutrition-tools";
import { addDays } from "@/lib/dates";
import { fetchAll } from "@/lib/pagination";
import type { Json } from "@/integrations/supabase/types";

/** Reads preserve unsynced records and hydrate only the accepted cache epoch. */
export function useNutritionData(
  userId: string,
  day: string,
  currentDay: string,
  offline: boolean,
) {
  const { state: local } = useMemberData(userId);
  const qc = useQueryClient();
  const key = ["nutrition", userId, day];
  const outsideCache = day < addDays(currentDay, -6);
  const localMode = offline && !outsideCache;

  const {
    data: remoteData,
    error: loadError,
    refetch: retryNutrition,
  } = useQuery({
    queryKey: [...key, !!offline, currentDay],
    enabled: !offline || navigator.onLine,
    queryFn: async () => {
      const cacheToken = localMode ? await beginMemberRead(userId) : {};
      const [food, water, targets] = await Promise.all([
        fetchAll(
          (from, to) =>
            supabase
              .from("food_logs")
              .select("*")
              .eq("member_id", userId)
              .gte("log_date", localMode ? addDays(currentDay, -6) : day)
              .lte("log_date", localMode ? currentDay : day)
              .order("created_at")
              .order("id")
              .range(from, to),
          (r) => r.id,
        ).then((data) => ({ data, error: null })),
        fetchAll(
          (from, to) =>
            supabase
              .from("water_logs")
              .select("*")
              .eq("member_id", userId)
              .gte("log_date", localMode ? addDays(currentDay, -6) : day)
              .lte("log_date", localMode ? currentDay : day)
              .order("id")
              .range(from, to),
          (r) => r.id,
        ).then((data) => ({ data, error: null })),
        supabase.from("nutrition_targets").select("*").eq("member_id", userId).maybeSingle(),
      ]);
      if (food.error) throw food.error;
      if (water.error) throw water.error;
      if (targets.error) throw targets.error;
      if (localMode) {
        const foodCached = await retainMemberRows(userId, "food_logs", food.data, cacheToken);
        const waterCached = await retainMemberRows(userId, "water_logs", water.data, cacheToken);
        if (foodCached && waterCached)
          await changeMemberState(userId, (s) => ({
            ...s,
            references: {
              ...s.references,
              targets: targets.data as Json,
              foodWindow: { from: addDays(currentDay, -6), to: currentDay },
            },
          }));
      }
      return { food: food.data, water: water.data, targets: targets.data };
    },
  });
  const data = localMode
    ? {
        food: (local.records.food_logs ?? []).filter((r) => r.log_date === day) as NonNullable<
          typeof remoteData
        >["food"],
        water: (local.records.water_logs ?? []).filter((r) => r.log_date === day) as NonNullable<
          typeof remoteData
        >["water"],
        targets: local.references.targets as NonNullable<typeof remoteData>["targets"],
      }
    : offline
      ? {
          food: pendingNutritionRows(
            remoteData?.food ?? [],
            (local.records.food_logs ?? []).filter((r) => r.log_date === day) as NonNullable<
              typeof remoteData
            >["food"],
            new Set(local.queue.filter((m) => m.entity === "food_logs").map((m) => m.record_id)),
          ),
          water: pendingNutritionRows(
            remoteData?.water ?? [],
            (local.records.water_logs ?? []).filter((r) => r.log_date === day) as NonNullable<
              typeof remoteData
            >["water"],
            new Set(local.queue.filter((m) => m.entity === "water_logs").map((m) => m.record_id)),
          ),
          targets:
            remoteData?.targets ??
            (local.references.targets as NonNullable<typeof remoteData>["targets"]),
        }
      : remoteData;
  const cachedWindow = local.references["foodWindow"] as { from: string; to: string } | undefined;
  const totalsAvailable = localMode
    ? !!cachedWindow && day >= cachedWindow.from && day <= cachedWindow.to
    : !!remoteData;
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: key }),
      qc.invalidateQueries({ queryKey: ["today", userId] }),
    ]);

  return { local, data, totalsAvailable, loadError, retryNutrition, refresh };
}
