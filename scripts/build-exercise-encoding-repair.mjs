// Match exact damaged-source hashes; never blindly decode human-edited text.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { asciiJson, catalogueRow } from "./lib/exercise-catalogue.mjs";
const read = async (name) => JSON.parse(await readFile(`public/data/${name}.json`, "utf8"));
const reference = await read("exercise-reference"),
  arabic = await read("exercise-arabic"),
  visuals = await read("exercise-visuals");
if (reference.revision !== arabic.revision || reference.revision !== visuals.revision)
  throw new Error("Revision mismatch");
const hash = (s) => createHash("md5").update(s, "utf8").digest("hex");
const corrupt = (s) => new TextDecoder("windows-1252").decode(Buffer.from(s, "utf8"));
const input = reference.exercises.map((source, i) => {
  const row = catalogueRow(
    source,
    arabic.exercises[i],
    reference.revision,
    arabic.translation,
    visuals.exercises[i],
  );
  const text = {
    name_ar: row.name_ar,
    name_en: row.name_en,
    steps_ar: row.guidance.steps_ar,
    steps_en: row.guidance.steps_en,
    attribution: row.guidance.catalogue_media.attribution,
  };
  return {
    source_id: source.id,
    hashes: Object.fromEntries(
      Object.entries(text).map(([k, v]) => [k, { bad: hash(corrupt(v)), good: hash(v) }]),
    ),
  };
});
const win = [
  0x80, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8e, 0x91, 0x92, 0x93,
  0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9e, 0x9f,
];
const chars = win.map((x) =>
  new TextDecoder("windows-1252").decode(Uint8Array.of(x)).charCodeAt(0),
);
const from = chars.map((n) => `chr(${n})`).join("||"),
  to = win.map((n) => `chr(${n})`).join("||");
const dir = "artifacts/catalogue-encoding-repair";
await mkdir(dir, { recursive: true });
for (let i = 0; i < input.length; i += 200) {
  const rows = input.slice(i, i + 200),
    literal = asciiJson(rows).replaceAll("'", "''");
  await writeFile(
    `${dir}/repair-${String(i / 200 + 1).padStart(2, "0")}.sql`,
    `BEGIN;
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(7132401);
CREATE FUNCTION pg_temp.fix_catalogue_text(v text,h jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE repaired text;
BEGIN
 IF md5(v) IS DISTINCT FROM h->>'bad' OR h->>'bad'=h->>'good' THEN RETURN v; END IF;
 repaired=convert_from(convert_to(translate(v,${from},${to}),'LATIN1'),'UTF8');
 IF md5(repaired) IS DISTINCT FROM h->>'good' THEN RAISE EXCEPTION 'Catalogue repair content mismatch'; END IF;
 RETURN repaired;
END $$;
WITH input AS (SELECT * FROM jsonb_to_recordset('${literal}'::jsonb) AS r(source_id text,hashes jsonb)),
patch AS (SELECT e.id,r.hashes,
 coalesce((SELECT jsonb_object_agg(k,pg_temp.fix_catalogue_text(e.guidance->>k,r.hashes->k)) FROM unnest(ARRAY['steps_ar','steps_en']) k WHERE r.hashes->k->>'good'<>r.hashes->k->>'bad' AND md5(e.guidance->>k)=r.hashes->k->>'bad'),'{}') AS guidance_patch
 FROM public.exercises e JOIN input r ON e.guidance->'text_source'->>'exercise_id'=r.source_id
 WHERE e.guidance->'text_source'->>'repository'='hasaneyldrm/exercises-dataset' AND e.guidance->'text_source'->>'revision'='${reference.revision}')
UPDATE public.exercises e SET
 name_ar=pg_temp.fix_catalogue_text(e.name_ar,p.hashes->'name_ar'),
 name_en=pg_temp.fix_catalogue_text(e.name_en,p.hashes->'name_en'),
 aliases=ARRAY(SELECT pg_temp.fix_catalogue_text(a,p.hashes->'name_en') FROM unnest(e.aliases) a),
 guidance=CASE WHEN md5(e.guidance->'catalogue_media'->>'attribution')=p.hashes->'attribution'->>'bad'
  THEN jsonb_set(e.guidance || p.guidance_patch,'{catalogue_media,attribution}',to_jsonb(pg_temp.fix_catalogue_text(e.guidance->'catalogue_media'->>'attribution',p.hashes->'attribution')))
  ELSE e.guidance || p.guidance_patch END
FROM patch p WHERE e.id=p.id AND (
 (md5(e.name_ar)=p.hashes->'name_ar'->>'bad' AND p.hashes->'name_ar'->>'good'<>p.hashes->'name_ar'->>'bad') OR
 (md5(e.name_en)=p.hashes->'name_en'->>'bad' AND p.hashes->'name_en'->>'good'<>p.hashes->'name_en'->>'bad') OR
 p.guidance_patch<>'{}' OR md5(e.guidance->'catalogue_media'->>'attribution')=p.hashes->'attribution'->>'bad' OR
 (p.hashes->'name_en'->>'good'<>p.hashes->'name_en'->>'bad' AND EXISTS(SELECT 1 FROM unnest(e.aliases) a WHERE md5(a)=p.hashes->'name_en'->>'bad')));
DROP FUNCTION pg_temp.fix_catalogue_text(text,jsonb);
COMMIT;
`,
  );
}
console.log(`Prepared ${Math.ceil(input.length / 200)} ASCII-only repair chunks`);
