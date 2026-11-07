import { z } from "zod";
export const friend = z.object({
  member_id: z.string().uuid(),
  name: z.string().nullable(),
  status: z.enum(["pending", "accepted"]),
  incoming: z.boolean(),
});
export const challenge = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  title: z.string(),
  metric: z.enum(["cardio_minutes", "workout_days"]),
  goal: z.number(),
  starts_on: z.string(),
  ends_on: z.string(),
  status: z.enum(["active", "completed", "cancelled"]),
  completed_at: z.string().nullable(),
  progress: z.number(),
  participation: z.enum(["invited", "accepted"]).nullable(),
  participants: z.number(),
});
export const socialState = z.object({
  account: z.object({
    member_id: z.string().uuid(),
    code: z.string(),
    discoverable: z.boolean(),
    sharing: z.boolean(),
  }),
  friends: z.array(friend),
  blocked: z.array(z.object({ member_id: z.string().uuid() })),
  challenges: z.array(challenge),
});
export type SocialState = z.output<typeof socialState>;
export const challengeDraft = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(100),
    metric: z.enum(["cardio_minutes", "workout_days"]),
    goal: z.number().int().min(1).max(10000),
    starts_on: z.string(),
    ends_on: z.string(),
  })
  .strict();
