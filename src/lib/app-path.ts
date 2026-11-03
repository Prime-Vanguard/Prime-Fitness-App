/** Public URLs include the hosting prefix; router destinations remain application-relative. */
export const appBase = () => import.meta.env.BASE_URL || "/";
export const appPath = (path: string) => appBase() + path.replace(/^\/+/, "");
export function stripAppBase(path: string) {
  const base = appBase();
  if (base === "/") return path;
  if (path === base.slice(0, -1)) return "/";
  return path.startsWith(base) ? "/" + path.slice(base.length) : path;
}
