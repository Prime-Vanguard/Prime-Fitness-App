import { supabase } from "@/integrations/supabase/client";
/** UI preflight only: database policies remain authoritative on every subsequent request. */
export async function coachMemberAccess(actor: string, member: string) {
  const [person, roles] = await Promise.all([
    supabase.from("profiles").select("id,access_active").eq("id", actor).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", actor),
  ]);
  if (person.error) throw person.error;
  if (roles.error) throw roles.error;
  if (!person.data?.access_active) return null;
  const names = roles.data.map((row) => row.role),
    admin = names.includes("admin") || names.includes("super_admin");
  if (!admin) {
    if (!names.includes("coach")) return null;
    const assignment = await supabase
      .from("coach_assignments")
      .select("member_id")
      .eq("member_id", member)
      .eq("coach_id", actor)
      .eq("active", true)
      .maybeSingle();
    if (assignment.error) throw assignment.error;
    if (!assignment.data) return null;
  }
  const profile = await supabase
    .from("profiles")
    .select("id,display_name,email")
    .eq("id", member)
    .maybeSingle();
  if (profile.error) throw profile.error;
  return profile.data;
}
