import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FoodEntryMode } from "./contracts";
import { useMemberData } from "@/hooks/use-member-data";
import { useTrainingFeatures } from "@/hooks/use-training-features";
export function useFoodLibrary(userId: string, entry: FoodEntryMode | undefined) {
  const { state: local } = useMemberData(userId);
  const { data: features } = useTrainingFeatures(userId);
  const {
    data: lib,
    error: libraryError,
    isPending: libraryPending,
    refetch: retryLibrary,
  } = useQuery({
    queryKey: ["food-lib", userId],
    enabled: !!entry && entry !== "favorites" && navigator.onLine,
    queryFn: async () => {
      const [foods, recent] = await Promise.all([
        supabase
          .from("foods")
          .select("id,name_en,name_ar,serving,calories,protein_g,carbs_g,fat_g")
          .eq("active", true)
          .order("name_en"),
        supabase
          .from("food_logs")
          .select("name,calories,protein_g,carbs_g,fat_g")
          .eq("member_id", userId)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (foods.error) throw foods.error;
      if (recent.error) throw recent.error;
      const seen = new Set<string>();
      const rec = (recent.data ?? [])
        .filter((r) => {
          const k = JSON.stringify([
            r["name"].toLowerCase(),
            r["calories"],
            r["protein_g"],
            r["carbs_g"],
            r["fat_g"],
          ]);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, 8);
      return { foods: foods.data, recent: rec };
    },
  });

  const seen = new Set<string>();
  const cachedRecent =
    features?.offline && !navigator.onLine
      ? [...(local.records.food_logs ?? [])]
          .sort(
            (a, b) =>
              String(b.log_date).localeCompare(String(a.log_date)) ||
              String(b["created_at"] ?? "").localeCompare(String(a["created_at"] ?? "")),
          )
          .map((row) => ({
            name: String(row["name"]),
            calories: Number(row["calories"]),
            protein_g: Number(row["protein_g"]),
            carbs_g: Number(row["carbs_g"]),
            fat_g: Number(row["fat_g"]),
          }))
          .filter((row) => {
            const key = JSON.stringify(row);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 8)
      : null;
  return {
    lib: cachedRecent ? { foods: lib?.foods ?? [], recent: cachedRecent } : lib,
    libraryError,
    libraryPending: libraryPending && !cachedRecent,
    retryLibrary,
  };
}
