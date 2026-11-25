import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useXpRules = () =>
  useQuery({
    queryKey: ["xp-rules"],
    staleTime: 300000,
    queryFn: async () => {
      const result = await supabase.from("xp_rules").select("*").single();
      if (result.error) throw result.error;
      return result.data;
    },
  });
