import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FoodEntryMode } from "./contracts";
export function useFoodLibrary(userId: string, entry: FoodEntryMode | undefined) {
  const {
    data: lib,
    error: libraryError,
    isPending: libraryPending,
    refetch: retryLibrary,
  } = useQuery({
    queryKey: ["food-lib", userId],
    enabled: entry === "search" || entry === "recent",
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
      const seen = new Set<string>();
      const rec = (recent.data ?? [])
        .filter((r) => {
          const k = r.name.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, 8);
      return { foods: foods.data, recent: rec };
    },
  });

  return { lib, libraryError, libraryPending, retryLibrary };
}
