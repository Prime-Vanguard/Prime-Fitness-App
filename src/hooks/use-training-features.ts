import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { readMemberState, changeMemberState } from "@/lib/member-store";
import type { Json } from "@/integrations/supabase/types";
export type TrainingFeature =
  | "guidance"
  | "logging"
  | "progression"
  | "scheduling"
  | "imports"
  | "offline"
  | "food_scanning"
  | "cardio"
  | "social";
export function useTrainingFeatures(userId: string) {
  const query = useQuery({
    queryKey: ["training-features", userId],
    staleTime: 30000,
    retry: 0,
    networkMode: "always",
    queryFn: async () => {
      if (!navigator.onLine)
        return {
          features: ((await readMemberState(userId)).references["trainingFeatures"] ??
            {}) as Partial<Record<TrainingFeature, boolean>>,
          offlineCacheUnavailable: false,
        };
      const { data, error } = await supabase.rpc("get_training_features");
      if (error) throw error;
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        Object.values(data).some((value) => typeof value !== "boolean")
      )
        throw new Error("Feature availability could not be checked.");
      let offlineCacheUnavailable = false;
      try {
        await changeMemberState(userId, (s) => ({
          ...s,
          references: { ...s.references, trainingFeatures: data as Json },
        }));
      } catch {
        // An optional offline-cache failure must not hide an authorized online feature.
        offlineCacheUnavailable = true;
      }
      return {
        features: data as Partial<Record<TrainingFeature, boolean>>,
        offlineCacheUnavailable,
      };
    },
  });
  return {
    ...query,
    data: query.data?.features,
    offlineCacheUnavailable: query.data?.offlineCacheUnavailable ?? false,
  };
}
