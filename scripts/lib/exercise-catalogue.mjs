import { createHash } from "node:crypto";

export const repository = "hasaneyldrm/exercises-dataset";
// Explicit equivalents already used by the app, plus unambiguous barbell/bodyweight names.
const equivalents = {
  "0043": ["Barbell Back Squat"],
  "0027": ["Barbell Row"],
  "0198": ["Lat Pulldown"],
  "0294": ["Dumbbell Curl"],
  "0314": ["Incline Dumbbell Press"],
  "0025": ["Bench Press"],
  "0032": ["Deadlift"],
  "0085": ["Romanian Deadlift"],
  "0652": ["Pull-up"],
};
const equipmentNames = {
  "body weight": "bodyweight",
  "ez barbell": "ez_bar",
  "leverage machine": "machine",
  "smith machine": "smith_machine",
  "stability ball": "stability_ball",
  "medicine ball": "medicine_ball",
  "bosu ball": "bosu_ball",
};
const muscles = {
  abs: "core",
  quads: "quads",
  lats: "back",
  calves: "calves",
  pectorals: "chest",
  glutes: "glutes",
  hamstrings: "hamstrings",
  triceps: "triceps",
  spine: "back",
  "upper back": "back",
  biceps: "biceps",
  delts: "shoulders",
  traps: "back",
};
export function catalogueId(sourceId) {
  const h = createHash("sha256").update(`${repository}:${sourceId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function catalogueRow(row, arabic, revision, translation, visual) {
  if (
    !arabic ||
    arabic.id !== row.id ||
    arabic.steps_ar.length !== row.steps_en.length ||
    !arabic.name_ar?.trim() ||
    arabic.steps_ar.some((s) => !s?.trim() || !/[\u0600-\u06ff]/.test(s))
  )
    throw new Error(`Missing/alignment error in Arabic: ${row.id}`);
  if (
    !visual ||
    visual.id !== row.id ||
    !/^images\/[\w-]+\.(jpg|jpeg|png)$/.test(visual.image) ||
    !/^videos\/[\w-]+\.gif$/.test(visual.gif)
  )
    throw new Error(`Missing/invalid media: ${row.id}`);
  const equipment = equipmentNames[row.equipment] ?? row.equipment.replaceAll(" ", "_");
  const cardio = row.target === "cardiovascular system";
  const timed =
    cardio || /stretch|isometric|\bhold\b/.test(row.name) || row.name === "weighted front plank";
  const bodyweight = row.equipment === "body weight" || row.equipment === "assisted";
  const base = `https://raw.githubusercontent.com/${repository}/${revision}/`;
  return {
    id: catalogueId(row.id),
    source_id: row.id,
    name_en: row.name,
    name_ar: arabic.name_ar,
    match_names: [row.name, ...(equivalents[row.id] ?? [])],
    muscle: muscles[row.target] ?? (cardio ? "cardio" : row.target.replaceAll(" ", "_")),
    equipment,
    aliases: [row.name, ...(equivalents[row.id] ?? [])],
    logging_mode: timed ? "timed" : bodyweight ? "bodyweight_reps" : "weighted_reps",
    load_convention: bodyweight
      ? "bodyweight"
      : ["dumbbell", "kettlebell"].includes(equipment)
        ? "per_hand"
        : "external_total",
    guidance: {
      steps_en: row.steps_en.join("\n"),
      steps_ar: arabic.steps_ar.join("\n"),
      text_source: { repository, revision, exercise_id: row.id, license: "MIT" },
      translation,
      catalogue_kind: cardio ? "cardio" : "strength",
      classification_status: "needs_review",
      source_target: row.target,
      secondary_muscles: row.secondary_muscles,
      catalogue_media: {
        poster: base + visual.image,
        gif: base + visual.gif,
        author: "Gym Visual",
        license: "Gym Visual commercial catalogue",
        permission: "Application owner confirmed catalogue licensing",
        attribution: "© Gym Visual · gymvisual.com",
      },
    },
  };
}
// ASCII JSON escapes survive Windows shell code-page decoding unchanged.
export const asciiJson = (value) =>
  JSON.stringify(value).replace(
    /[^\x00-\x7f]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
export function catalogueChunkSql(rows) {
  // Existing prescriptions, Arabic names, archives and measurement conventions always win.
  return `BEGIN;
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(7132401);
CREATE TEMP TABLE catalogue_input ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset(${quote(asciiJson(rows))}::jsonb)
AS r(id uuid,source_id text,name_en text,name_ar text,match_names jsonb,muscle text,equipment text,aliases jsonb,logging_mode text,load_convention text,guidance jsonb);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM catalogue_input r WHERE (SELECT count(*) FROM public.exercises e WHERE
   (e.guidance->'text_source'->>'repository'=${quote(repository)} AND e.guidance->'text_source'->>'exercise_id'=r.source_id)
   OR (e.guidance->'text_source' IS NULL AND lower(trim(e.name_en)) IN (SELECT lower(value) FROM jsonb_array_elements_text(r.match_names)) AND e.equipment=r.equipment))>1)
 THEN RAISE EXCEPTION 'Ambiguous catalogue match; review before importing'; END IF;
END $$;
INSERT INTO public.exercises(id,name_en,name_ar,muscle,equipment,equipment_tags,aliases,logging_mode,load_convention,guidance,editorial_status)
SELECT coalesce((SELECT e.id FROM public.exercises e WHERE
  (e.guidance->'text_source'->>'repository'=${quote(repository)} AND e.guidance->'text_source'->>'exercise_id'=r.source_id)
  OR (e.guidance->'text_source' IS NULL AND lower(trim(e.name_en)) IN (SELECT lower(value) FROM jsonb_array_elements_text(r.match_names)) AND e.equipment=r.equipment)),r.id),
 r.name_en,r.name_ar,r.muscle,r.equipment,ARRAY[r.equipment],ARRAY(SELECT jsonb_array_elements_text(r.aliases)),r.logging_mode,r.load_convention,r.guidance,'needs_review'
FROM catalogue_input r
ON CONFLICT(id) DO UPDATE SET
 name_ar=coalesce(nullif(public.exercises.name_ar,''),EXCLUDED.name_ar),
 aliases=ARRAY(SELECT DISTINCT value FROM unnest(public.exercises.aliases || EXCLUDED.aliases) value ORDER BY value),
 guidance=EXCLUDED.guidance || public.exercises.guidance
WHERE public.exercises.editorial_status<>'reviewed'
 AND (public.exercises.guidance->'text_source' IS NULL OR
  (public.exercises.guidance->'text_source'->>'repository'=${quote(repository)} AND public.exercises.guidance->'text_source'->>'exercise_id'=EXCLUDED.guidance->'text_source'->>'exercise_id'));
COMMIT;
`;
}
