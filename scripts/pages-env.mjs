import { readFile, writeFile } from "node:fs/promises";
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
