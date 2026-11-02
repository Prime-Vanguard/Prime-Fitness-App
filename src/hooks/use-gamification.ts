import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { levelFor, rankFor } from "@/lib/levels";

export function useGamification(userId: string) {
  return useQuery({
    queryKey: ["gamification", userId],
    queryFn: async () => {
      const [xp, th, pv, totals] = await Promise.all([
        supabase
          .from("xp_events")
          .select("id,amount,source,created_at")
          .eq("member_id", userId)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("level_thresholds").select("level,xp_required,provisional").order("level"),
        supabase.from("member_pv_totals").select("points").eq("member_id", userId).maybeSingle(),
        supabase.from("member_xp_totals").select("xp").eq("member_id", userId).maybeSingle(),
      ]);
      if (xp.error) throw xp.error;
      if (th.error) throw th.error;
      if (pv.error) throw pv.error;
      if (totals.error) throw totals.error;
      const total = totals.data?.xp ?? 0;
      const lv = levelFor(total, th.data);
      return {
        xp: total,
        provisional: th.data.some((row) => row.provisional),
        ...lv,
        rank: rankFor(lv.level),
        pv: pv.data?.points ?? 0,
        recent: xp.data.slice(0, 8),
      };
    },
  });
}
