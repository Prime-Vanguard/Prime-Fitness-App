// Builds public metadata only. Source image/GIF files remain at the pinned upstream revision.
import { readFile, writeFile } from "node:fs/promises";
const [reference, media] = await Promise.all(
  ["exercise-reference.json", "exercise-media-preview.json"].map(async (name) =>
    JSON.parse(await readFile(new URL(`../public/data/${name}`, import.meta.url), "utf8")),
  ),
);
if (reference.revision !== media.revision) throw new Error("Catalogue revisions differ");
const paths = new Map(media.previews.map((row) => [row.id, row]));
if (paths.size !== media.previews.length) throw new Error("Duplicate media IDs");
const exercises = reference.exercises.map((row) => {
  const visual = paths.get(row.id);
  if (
    !visual ||
    !/^\d{4}$/.test(row.id) ||
    !/^images\/[\w-]+\.(jpg|jpeg|png)$/.test(visual.image) ||
    !/^videos\/[\w-]+\.gif$/.test(visual.gif)
  )
    throw new Error(`Invalid/missing visual: ${row.id}`);
  return {
    id: row.id,
    name: row.name,
    equipment: row.equipment,
    image: visual.image,
    gif: visual.gif,
  };
});
if (
  exercises.length !== paths.size ||
  new Set(exercises.map((row) => row.id)).size !== exercises.length
)
  throw new Error("Catalogue coverage differs");
await writeFile(
  new URL("../public/data/exercise-visuals.json", import.meta.url),
  JSON.stringify({ revision: reference.revision, exercises }) + "\n",
);
console.log(`Prepared ${exercises.length} pinned image/GIF references; no media files downloaded.`);
