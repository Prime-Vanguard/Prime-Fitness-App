/** Backend identity is part of every private device-storage/coordination key. */
export function deviceScope(user: string) {
  const project = import.meta.env["VITE_SUPABASE_URL"]?.replace(/\/+$/, "");
  if (!project)
    throw new Error("Project configuration is unavailable. Existing device drafts are retained.");
  return JSON.stringify([project, user]);
}
