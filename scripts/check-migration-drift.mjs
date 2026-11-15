import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

// Read-only comparator: never executes SQL, renames files or repairs hosted history.
// Export version/name/array_to_string(statements,E'\\n') AS sql from migration metadata.
const input = process.argv[2];
if (!input)
  throw new Error("Usage: node scripts/check-migration-drift.mjs <hosted-statements.json>");
const rows = JSON.parse(await readFile(input, "utf8"));
if (!Array.isArray(rows)) throw new Error("Expected migration metadata array");
const files = (await readdir("supabase/migrations")).filter((f) => /^\d{14}_.+\.sql$/.test(f));
const normalized = (sql) => sql.replace(/\r\n/g, "\n").trim();
const hash = (sql) => createHash("sha256").update(normalized(sql)).digest("hex");
const seen = new Set();
const comparisons = [];
for (const row of rows) {
  if (
    !row ||
    typeof row.name !== "string" ||
    typeof row.sql !== "string" ||
    !/^\d{14}$/.test(row.version) ||
    seen.has(row.name)
  )
    throw new Error("Invalid or duplicate migration metadata");
  seen.add(row.name);
  const matches = files.filter((f) => f.slice(15, -4) === row.name);
  if (matches.length !== 1)
    throw new Error("Hosted migration name does not map uniquely to a repository file");
  const file = matches[0];
  const local = await readFile("supabase/migrations/" + file, "utf8");
  comparisons.push({
    name: row.name,
    local_version: file.slice(0, 14),
    hosted_version: row.version,
    local_sha256: hash(local),
    hosted_sha256: hash(row.sql),
    text_matches: normalized(local) === normalized(row.sql),
  });
}
console.log(
  JSON.stringify(
    {
      normalization: "CRLF to LF and outer whitespace only; SQL semantics are not inferred",
      input_count: rows.length,
      repository_count: files.length,
      comparisons,
    },
    null,
    2,
  ),
);
if (comparisons.some((r) => !r.text_matches || r.local_version !== r.hosted_version))
  process.exitCode = 1;
