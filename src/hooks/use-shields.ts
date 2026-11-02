import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export function useShields(userId: string) {
  return useQuery({
    queryKey: ["shields", userId],
    queryFn: async () => {
      const r = await supabase
        .from("streak_shields")
        .select("shield_date")
        .eq("member_id", userId)
        .order("shield_date", { ascending: false });
      if (r.error) throw r.error;
      return r.data.map((row) => row.shield_date);
    },
  });
}
