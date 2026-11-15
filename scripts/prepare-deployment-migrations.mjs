import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, sep, isAbsolute } from "node:path";
import { createHash } from "node:crypto";

// Build a disposable CLI workspace; preserve both repository and hosted histories.
// This command never connects to Supabase or changes applied migration metadata.
const output = resolve(process.argv[2] ?? "artifacts/deployment-migrations");
const inside = relative(resolve("artifacts"), output);
if (
  !inside ||
  isAbsolute(inside) ||
  inside.startsWith("..") ||
  inside.startsWith(sep) ||
  resolve(output) === resolve("artifacts")
)
  throw new Error("Output must be a new directory inside artifacts");
const manifest = JSON.parse(await readFile("docs/readiness/migration-identity-map.json", "utf8"));
const files = (await readdir("supabase/migrations")).filter((f) => /^\d{14}_.+\.sql$/.test(f));
const staged = [];
const used = new Set();
for (const file of files) {
  const sql = await readFile("supabase/migrations/" + file, "utf8");
  const mapping = manifest.mappings.find((m) => file === `${m.repository_version}_${m.name}.sql`);
  const hash = createHash("sha256").update(sql.replace(/\r\n/g, "\n").trim()).digest("hex");
  if (mapping && mapping.sha256 !== hash)
    throw new Error("Previously applied migration content changed: " + file);
  const name = mapping ? `${mapping.hosted_version}_${mapping.name}.sql` : file;
  if (used.has(name.slice(0, 14))) throw new Error("Duplicate deployment migration version");
  used.add(name.slice(0, 14));
  staged.push({ name, sql });
}
for (const m of manifest.mappings)
  if (!files.includes(`${m.repository_version}_${m.name}.sql`))
    throw new Error("Mapped source migration is missing");
await mkdir(output); // Refuse reuse: a stale workspace must never retain old SQL.
await mkdir(resolve(output, "supabase/migrations"), { recursive: true });
await writeFile(resolve(output, "supabase/config.toml"), `project_id = "${manifest.project_id}"\n`);
for (const file of staged)
  await writeFile(resolve(output, "supabase/migrations", file.name), file.sql);
console.log(
  JSON.stringify({
    workspace: relative(process.cwd(), output),
    migrations: staged.length,
    mapped: manifest.mappings.length,
    hosted_changes: false,
  }),
);
