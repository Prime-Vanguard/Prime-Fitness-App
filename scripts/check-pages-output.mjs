import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const root = "dist/client";
const publicEnv = Object.fromEntries(
  (await readFile(".env.pages.local", "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => [
      line.slice(0, line.indexOf("=")),
      JSON.parse(line.slice(line.indexOf("=") + 1)),
    ]),
);
const expected = [publicEnv.VITE_SUPABASE_URL, publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY];
const compiled = expected.map(() => false);
let count = 0;
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await check(file);
    else {
      count++;
      if (/\.(html|js|json|webmanifest|css)$/.test(file)) {
        const text = await readFile(file, "utf8");
        if (file.endsWith(".js"))
          expected.forEach((value, index) => {
            compiled[index] ||= !!value && text.includes(value);
          });
        if (
          /sb_secret_[A-Za-z0-9_-]{15,}|SUPABASE_SERVICE_ROLE_KEY|-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(
            text,
          )
        ) {
          throw new Error(`Private credential marker found in static output: ${file}`);
        }
        for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
          try {
            if (JSON.parse(Buffer.from(match[1], "base64url").toString()).role === "service_role") {
              throw new Error(`Privileged JWT found in static output: ${file}`);
            }
          } catch (error) {
            if (error.message.startsWith("Privileged JWT")) throw error;
          }
        }
      }
    }
  }
}
await check(root);
if (compiled.some((found) => !found)) {
  throw new Error(
    "The selected public backend configuration is missing from the compiled frontend.",
  );
}
const html = await readFile(join(root, "index.html"), "utf8");
for (const match of html.matchAll(/(?:src|href)="(\/[^"\s]+)"/g)) {
  if (!match[1].startsWith("/Prime-Fitness-App/"))
    throw new Error(`Unscoped asset in Pages shell: ${match[1]}`);
}
console.log(`Checked ${count} public output files for credential markers and scoped shell assets.`);
