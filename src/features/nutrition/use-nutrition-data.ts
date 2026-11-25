import { offlineHistoryStart } from "@/lib/offline-window";
import { personalHistoryCoverage } from "@/lib/offline-preparation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemberData, beginMemberRead } from "@/hooks/use-member-data";
import { cacheNutritionWindow } from "@/lib/member-store";
import { pendingNutritionRows } from "@/lib/nutrition-tools";
import { addDays } from "@/lib/dates";
import { fetchAll } from "@/lib/pagination";

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
  const preparedRanges = personalHistoryCoverage(local, userId);
  const isPreparedDate = (date: string) =>
    preparedRanges.some(({ from, to }) => date >= from && date <= to);
  const recentWindow = local.references["foodWindow"] as { from: string; to: string } | undefined;
  const isCachedDate = (date: string) =>
    isPreparedDate(date) ||
    (!!recentWindow && date >= recentWindow.from && date <= recentWindow.to);
  const recentStart = offlineHistoryStart(currentDay);
  const cacheRecentWindow = offline && day >= recentStart;
  // Keep fetching live history for older dates while connected. The explicit
  // download is the fallback when the device has no connection.
  const localMode = cacheRecentWindow || (offline && !navigator.onLine && isPreparedDate(day));

  const {
    data: remoteData,
    error: loadError,
    isFetching,
    refetch: retryNutrition,
  } = useQuery({
    queryKey: [...key, !!offline, currentDay],
    enabled: !offline || navigator.onLine,
    queryFn: async () => {
      const cacheToken = cacheRecentWindow ? await beginMemberRead(userId) : {};
      const [food, water, targets] = await Promise.all([
        fetchAll(
          (from, to) =>
            supabase
              .from("food_logs")
              .select("*")
              .eq("member_id", userId)
              .gte("log_date", cacheRecentWindow ? recentStart : day)
              .lte("log_date", cacheRecentWindow ? currentDay : day)
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
              .gte("log_date", cacheRecentWindow ? recentStart : day)
              .lte("log_date", cacheRecentWindow ? currentDay : day)
              .order("id")
              .range(from, to),
          (r) => r.id,
        ).then((data) => ({ data, error: null })),
        supabase.from("nutrition_targets").select("*").eq("member_id", userId).maybeSingle(),
      ]);
      if (food.error) throw food.error;
      if (water.error) throw water.error;
      if (targets.error) throw targets.error;
      if (cacheRecentWindow)
        await cacheNutritionWindow(
          userId,
          food.data,
          water.data,
          { from: recentStart, to: currentDay },
          targets.data,
          cacheToken,
        );
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
  const totalsAvailable = localMode ? isCachedDate(day) : !!remoteData;
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: key }),
      qc.invalidateQueries({ queryKey: ["today", userId] }),
    ]);

  const dayStates: Record<string, { logged: boolean; pending: boolean; cached: boolean }> = {};
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(currentDay, -offset);
    const known = offline && isCachedDate(date);
    if (known || (date === day && !!remoteData)) {
      const rows = known
        ? (local.records.food_logs ?? []).filter((row) => row.log_date === date)
        : (remoteData?.food ?? []);
      dayStates[date] = {
        logged: rows.length > 0,
        pending: local.queue.some(
          (change) => change.entity === "food_logs" && change.payload.log_date === date,
        ),
        cached: !!known,
      };
    }
  }
  return {
    local,
    data,
    dayStates,
    totalsAvailable,
    loadError,
    isFetching,
    retryNutrition,
    refresh,
  };
}
