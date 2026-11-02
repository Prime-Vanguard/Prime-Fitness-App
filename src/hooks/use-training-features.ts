import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { readMemberState, changeMemberState } from "@/lib/member-store";
import type { Json } from "@/integrations/supabase/types";
export type TrainingFeature =
  "guidance" | "logging" | "progression" | "scheduling" | "imports" | "offline";
export function useTrainingFeatures(userId: string) {
  return useQuery({
    queryKey: ["training-features", userId],
    staleTime: 30000,
    retry: 0,
    networkMode: "always",
    queryFn: async () => {
      if (!navigator.onLine)
        return ((await readMemberState(userId)).references["trainingFeatures"] ?? {}) as Partial<
          Record<TrainingFeature, boolean>
        >;
      const { data, error } = await supabase.rpc("get_training_features");
      if (error) throw error;
      if (data && typeof data === "object" && !Array.isArray(data))
        await changeMemberState(userId, (s) => ({
          ...s,
          references: { ...s.references, trainingFeatures: data as Json },
        }));
      return data as Partial<Record<TrainingFeature, boolean>>;
    },
  });
}
