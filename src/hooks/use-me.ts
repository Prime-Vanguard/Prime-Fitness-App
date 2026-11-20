import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  withConnectionTimeout,
  isTransientConnectionError,
  readOfflineIdentity,
} from "@/lib/offline-access";
import { readOfflineProfile, saveOfflineProfile } from "@/lib/offline-profile-cache";
import { overlayPendingProfileSettings } from "@/lib/offline-profile-settings";
import type { Database } from "@/integrations/supabase/types";

type MemberProfile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

async function createMemberContext(
  profile: MemberProfile | null,
  roles: AppRole[],
  offlineProfileSaved: boolean,
  rolesUnavailable = false,
) {
  return {
    profile: profile ? await overlayPendingProfileSettings(profile) : null,
    roles,
    isAdmin: roles.includes("admin") || roles.includes("super_admin"),
    isSuperAdmin: roles.includes("super_admin"),
    offlineAccountPrepared: offlineProfileSaved && readOfflineIdentity()?.id === profile?.id,
    // Roles could not be confirmed over a failing connection. Staff screens stay
    // closed, and the query refetches until the server answers.
    rolesUnavailable,
  };
}
async function loadOfflineMemberContext(memberId: string, rolesUnavailable = false) {
  // Staff permissions need a fresh check until explicit downloads are implemented.
  return createMemberContext(await readOfflineProfile(memberId), [], true, rolesUnavailable);
}
const ROLE_RETRY_MS = 15000;
export function useMe(memberId: string) {
  return useQuery({
    queryKey: ["me", memberId],
    networkMode: "always",
    retry: false,
    refetchInterval: (query) => (query.state.data?.rolesUnavailable ? ROLE_RETRY_MS : false),
    queryFn: async () => {
      if (!navigator.onLine) return loadOfflineMemberContext(memberId);
      // Observe role failures immediately, but do not let them delay recording a
      // newly paused or missing profile. These reads remain parallel.
      const roleResult = withConnectionTimeout(
        supabase.from("user_roles").select("role").eq("user_id", memberId),
      ).then(
        (response) => ({ response, error: null }),
        (error: unknown) => ({ response: null, error }),
      );
      let profile: MemberProfile | null;
      try {
        const profileResponse = await withConnectionTimeout(
          supabase.from("profiles").select("*").eq("id", memberId).maybeSingle(),
        );
        if (profileResponse.error) throw profileResponse.error;
        profile = profileResponse.data;
      } catch (error) {
        if (isTransientConnectionError(error)) return loadOfflineMemberContext(memberId, true);
        throw error;
      }
      const offlineProfileSaved = await saveOfflineProfile(memberId, profile);
      if (!profile || !profile.access_active)
        return createMemberContext(profile, [], offlineProfileSaved);
      const { response: roleResponse, error: roleRequestError } = await roleResult;
      const roleError = roleRequestError ?? roleResponse?.error;
      if (roleError) {
        if (isTransientConnectionError(roleError))
          return createMemberContext(profile, [], offlineProfileSaved, true);
        throw roleError;
      }
      return createMemberContext(
        profile,
        (roleResponse?.data ?? []).map((role) => role.role),
        offlineProfileSaved,
      );
    },
  });
}
