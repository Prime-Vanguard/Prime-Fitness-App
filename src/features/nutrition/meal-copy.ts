import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  changeMemberState,
  readMemberState,
  queueMemberWrites,
  syncMemberEntries,
} from "@/lib/member-store";
import type { MemberState } from "@/lib/member-store";
import { mealItem, scaleMealItem, type MealItem } from "@/lib/nutrition-tools";
import { activityDay } from "@/lib/dates";
import { validActivityDate } from "@/lib/training-search";
import type { Json } from "@/integrations/supabase/types";

const schema = z.object({
  id: z.string().uuid(),
  day: z.string(),
  mode: z.enum(["native", "queued"]),
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        member_id: z.string().uuid(),
        log_date: z.string(),
        meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        name: z.string(),
        calories: z.number(),
        protein_g: z.number(),
        carbs_g: z.number(),
        fat_g: z.number(),
      }),
    )
    .min(1)
    .max(50),
});
export type MealCopy = z.infer<typeof schema>;
export function parseMealCopy(value: unknown, userId: string): MealCopy | null {
  if (value == null) return null;
  const copy = schema.parse(value);
  if (
    !validActivityDate(copy.day) ||
    copy.day > activityDay() ||
    new Set(copy.items.map((row) => row.id)).size !== copy.items.length
  )
    throw new Error("Invalid saved meal copy.");
  for (const row of copy.items) {
    if (row.member_id !== userId || row.log_date !== copy.day)
      throw new Error("Meal copy ownership or date mismatch.");
    mealItem(row);
  }
  return copy;
}
export function mergeMealCopyRecovery(
  current: MemberState["references"],
  incoming: MemberState["references"],
  owner: string,
  protectedIds = new Set<string>(),
) {
  const existing = parseMealCopy(current["mealCopy"], owner),
    saved = parseMealCopy(incoming["mealCopy"], owner);
  if (!saved) return current;
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(saved))
      throw new Error("Resolve the current meal copy before restoring another request.");
    return current;
  }
  if (saved.mode === "queued") {
    const known = saved.items.filter((row) => protectedIds.has(row.id)).length;
    if (known === saved.items.length) return current;
    if (known)
      throw new Error("Part of this saved meal copy already exists. Review it before restoring.");
  }
  return { ...current, mealCopy: saved as Json };
}
// Prepare stable ingredient identities before the member reviews and confirms a copy.
export async function prepareMealCopy(
  userId: string,
  day: string,
  meal: string,
  items: MealItem[],
  portion: string,
  offline: boolean,
) {
  const draft = parseMealCopy(
    {
      id: crypto.randomUUID(),
      day,
      mode: offline ? "queued" : "native",
      items: items.map((item) => ({
        ...scaleMealItem(item, portion),
        id: crypto.randomUUID(),
        member_id: userId,
        log_date: day,
        meal,
      })),
    },
    userId,
  )!;
  await changeMemberState(userId, (state) => {
    if (state.references["mealCopy"] != null)
      throw new Error("Resolve the saved meal copy before creating another.");
    return { ...state, references: { ...state.references, mealCopy: draft as Json } };
  });
  return draft;
}
// Reuse the prepared identities when a save is retried after an uncertain response.
export async function commitMealCopy(userId: string, value: MealCopy) {
  const copy = parseMealCopy(value, userId)!;
  const current = parseMealCopy((await readMemberState(userId)).references["mealCopy"], userId);
  if (!current || current.id !== copy.id || JSON.stringify(current) !== JSON.stringify(copy))
    throw new Error("The reviewed copy changed. Reload its saved request.");
  if (copy.mode === "queued") {
    await queueMemberWrites(
      userId,
      copy.items.map((record) => ({
        entity: "food_logs",
        op: "put",
        record,
        requireMissing: true,
      })),
      (references) => {
        if (parseMealCopy(references["mealCopy"], userId)?.id !== copy.id)
          throw new Error("This copy was already saved.");
        return { ...references, mealCopy: null };
      },
    );
    void syncMemberEntries(userId).catch(() => {});
  } else {
    // Stable UUIDs plus INSERT ... ON CONFLICT DO NOTHING reconcile lost responses.
    const result = await supabase
      .from("food_logs")
      .upsert(copy.items, { onConflict: "id", ignoreDuplicates: true });
    if (result.error) throw result.error;
    await changeMemberState(userId, (state) => ({
      ...state,
      references: {
        ...state.references,
        mealCopy:
          parseMealCopy(state.references["mealCopy"], userId)?.id === copy.id
            ? null
            : (state.references["mealCopy"] ?? null),
      },
    }));
  }
}
