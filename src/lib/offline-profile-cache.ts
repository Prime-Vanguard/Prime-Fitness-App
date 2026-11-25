import { z } from "zod";
import { changeMemberState, readMemberState } from "./member-store";
import type { Database } from "@/integrations/supabase/types";

type MemberProfile = Database["public"]["Tables"]["profiles"]["Row"];

// Safety fields are mandatory; missing account status is never defaulted.
const memberProfileSchema: z.ZodType<MemberProfile> = z.object({
  id: z.string().min(1),
  access_active: z.boolean(),
  onboarding_completed: z.boolean(),
  display_name: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  avatar_url: z.string().nullable().default(null),
  consent_at: z.string().nullable().default(null),
  locale: z.string().default("en"),
  units: z.string().default("metric"),
  timezone: z.string().default("Africa/Cairo"),
  leaderboard_opt_in: z.boolean().default(false),
  pod_feed_opt_in: z.boolean().default(false),
  training_preferences: z.json().nullable().default(null),
  created_at: z.string().default(""),
  updated_at: z.string().default(""),
});
const profileSnapshotSchema = z.object({
  version: z.literal(1),
  profile: memberProfileSchema,
  verifiedAt: z.iso.datetime(),
});
const legacyProfileSnapshotSchema = profileSnapshotSchema.omit({ version: true }).extend({
  version: z.never().optional(),
});

export async function readOfflineProfile(memberId: string): Promise<MemberProfile> {
  const storedSnapshot = (await readMemberState(memberId)).references["offlineProfile"];
  const snapshot = profileSnapshotSchema.safeParse(storedSnapshot);
  const legacySnapshot = legacyProfileSnapshotSchema.safeParse(storedSnapshot);
  const parsedSnapshot = snapshot.success
    ? snapshot.data
    : legacySnapshot.success
      ? legacySnapshot.data
      : null;
  if (!parsedSnapshot || parsedSnapshot.profile.id !== memberId) {
    throw new Error("Open your profile online to prepare this device for offline use.");
  }
  return parsedSnapshot.profile;
}

export async function saveOfflineProfile(
  memberId: string,
  profile: MemberProfile | null,
): Promise<boolean> {
  try {
    const snapshot = profile
      ? profileSnapshotSchema.parse({ version: 1, profile, verifiedAt: new Date().toISOString() })
      : null;
    if (snapshot && snapshot.profile.id !== memberId) return false;
    await changeMemberState(memberId, (state) => ({
      ...state,
      references: { ...state.references, offlineProfile: snapshot },
    }));
    return true;
  } catch {
    // Report incomplete preparation without blocking the working online session.
    return false;
  }
}
