import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const config = JSON.parse(await readFile("config/pages-public.json", "utf8"));
const url = new URL(process.env.VITE_SUPABASE_URL || config.supabaseUrl);
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || config.supabasePublishableKey;
if (url.protocol !== "https:" || !key?.startsWith("sb_publishable_")) {
  throw new Error("Pages requires an HTTPS Supabase URL and a public publishable key.");
}
await writeFile(
  ".env.pages.local",
  `VITE_SUPABASE_URL=${JSON.stringify(url.origin)}\nVITE_SUPABASE_PUBLISHABLE_KEY=${JSON.stringify(key)}\n`,
);
console.log("Configured the Pages build with public browser values.");
// Vite gives process.env precedence over dotenv, even for empty GitHub variables.
// Pass the resolved values to the build process so optional overrides stay optional.
const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--mode", "pages"],
  {
    stdio: "inherit",
    env: { ...process.env, VITE_SUPABASE_URL: url.origin, VITE_SUPABASE_PUBLISHABLE_KEY: key },
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
