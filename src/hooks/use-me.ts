import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMe(userId: string) {
  return useQuery({
    queryKey: ["me", userId],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (p.error) throw p.error;
      if (r.error) throw r.error;
      const roles = (r.data ?? []).map((x) => x.role);
      return {
        profile: p.data,
        roles,
        isAdmin: roles.includes("admin") || roles.includes("super_admin"),
        isSuperAdmin: roles.includes("super_admin"),
      };
    },
  });
}
