import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { changeMemberState, readMemberState } from "./member-store";
import type { Json } from "@/integrations/supabase/types";
const schema = z.object({
  id: z.string().uuid(),
  reward_id: z.string().uuid(),
  cost: z.number().int().positive(),
  title: z.string(),
  created_at: z.string(),
  error: z.string().optional(),
});
export type RedemptionIntent = z.infer<typeof schema>;
const key = "redemption-intents";
export async function readRedemptionIntents(user: string) {
  return z.array(schema).parse((await readMemberState(user)).references[key] ?? []);
}
export async function reserveRedemptionIntent(
  user: string,
  reward: string,
  cost: number,
  title: string,
) {
  let selected: RedemptionIntent | undefined;
  await changeMemberState(user, (s) => {
    const intents = z.array(schema).parse(s.references[key] ?? []);
    selected =
      intents.find((i) => i.reward_id === reward) ??
      schema.parse({
        id: crypto.randomUUID(),
        reward_id: reward,
        cost,
        title,
        created_at: new Date().toISOString(),
      });
    return {
      ...s,
      references: {
        ...s.references,
        [key]: [...intents.filter((i) => i.reward_id !== reward), selected!] as Json,
      },
    };
  });
  return selected!;
}
export async function finishRedemptionIntent(user: string, id: string) {
  await changeMemberState(user, (s) => ({
    ...s,
    references: {
      ...s.references,
      [key]: z
        .array(schema)
        .parse(s.references[key] ?? [])
        .filter((i) => i.id !== id) as Json,
    },
  }));
}
export async function repriceRedemptionIntent(user: string, id: string, cost: number) {
  await changeMemberState(user, (s) => ({
    ...s,
    references: {
      ...s.references,
      [key]: z
        .array(schema)
        .parse(s.references[key] ?? [])
        .map((i) =>
          i.id === id ? { ...i, cost: z.number().int().positive().parse(cost) } : i,
        ) as Json,
    },
  }));
}
export async function sendRedemptionIntent(user: string, intent: RedemptionIntent) {
  const auth = await supabase.auth.getSession();
  if (auth.data.session?.user.id !== user)
    throw new Error("Sign in again before retrying this request.");
  // Keep the UUID and approved price across uncertain failures; the server reconciles first.
  const { data, error } = await supabase
    .rpc("request_redemption", {
      _member: user,
      _request: intent.id,
      _reward: intent.reward_id,
      _expected_cost: intent.cost,
    })
    .abortSignal(AbortSignal.timeout(20000));
  if (error) throw error;
  const receipt = z
    .object({
      id: z.literal(intent.id),
      member_id: z.literal(user),
      reward_id: z.literal(intent.reward_id),
      status: z.enum(["pending", "fulfilled", "rejected"]),
    })
    .passthrough()
    .parse(data);
  await finishRedemptionIntent(user, intent.id);
  return receipt;
}
