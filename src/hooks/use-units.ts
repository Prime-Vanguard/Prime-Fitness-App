import { useMe } from "./use-me";
import type { Units } from "@/lib/units";
export function useUnits(userId: string): Units {
  return useMe(userId).data?.profile?.units === "imperial" ? "imperial" : "metric";
}
