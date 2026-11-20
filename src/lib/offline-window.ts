import { addDays } from "./dates";

export const OFFLINE_HISTORY_DAYS = 30;
export function offlineHistoryStart(activityDate: string) {
  return addDays(activityDate, 1 - OFFLINE_HISTORY_DAYS);
}
