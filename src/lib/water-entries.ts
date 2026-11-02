import { z } from "zod";
import { entryRecovery, type EntryUndo } from "./entry-recovery";
import { validActivityDate } from "./training-search";
import { inputNumber } from "./numeric-input";
const schema = z.object({
  id: z.string().uuid(),
  member_id: z.string().uuid(),
  log_date: z.string().refine(validActivityDate),
  revision: z.number().int().nonnegative(),
  ml: z.number().int().min(1).max(10000),
});
export type WaterEntry = z.infer<typeof schema>;
export type WaterUndo = EntryUndo<WaterEntry>;
export function waterEntry(row: Record<string, unknown>, owner: string) {
  const entry = schema.parse(row);
  if (entry.member_id !== owner) throw new Error("This water entry belongs to another member.");
  return entry;
}
export function waterAmount(value: string | number) {
  const ml = inputNumber(value, {
    label: "Water (ml)",
    integer: true,
    exclusiveMin: true,
    max: 10000,
  });
  if (ml == null) throw new Error("Enter a water amount.");
  return ml;
}
const recovery = entryRecovery("water_logs", "waterUndo", waterEntry, (row) => ({
  ml: row.ml,
  log_date: row.log_date,
}));
export const waterUndoEntries = recovery.entries,
  mergeWaterRecovery = recovery.merge,
  dismissWaterUndo = recovery.dismiss,
  deleteWaterEntry = recovery.del,
  finishWaterDeletion = recovery.finish,
  restoreWaterEntry = recovery.restore,
  waterEditAllowsMissing = recovery.allowsMissing;
export function saveWaterEdit(
  owner: string,
  original: WaterEntry,
  ml: string | number,
  queued: boolean,
  allowMissing: boolean,
) {
  return recovery.edit(owner, original, { ...original, ml: waterAmount(ml) }, queued, allowMissing);
}
