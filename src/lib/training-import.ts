import { activityDay } from "./dates";
import { normalizeExercise } from "./exercise-guidance";
export type ImportProvider = "strong" | "hevy" | "fitnotes";
export type ImportedSet = {
  id: string;
  source_exercise: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  duration_seconds: number | null;
  logging_mode: "weighted_reps" | "bodyweight_reps" | "timed";
  set_role: "working" | "warmup" | "drop";
  side: "bilateral" | "left" | "right";
  pair_id: string | null;
  root_set_id: string | null;
  segment_index: number;
  load_convention: "external_total" | "per_hand" | "bodyweight";
  slot_key: string;
};
export type ImportWorkout = {
  title: string;
  notes?: string | null;
  activity_date: string;
  started_at: string | null;
  finished_at: string | null;
  source_rows: Record<string, string>[];
  sets: ImportedSet[];
  warnings: string[];
};
export type ImportOptions = {
  provider: ImportProvider;
  units: "kg" | "lb";
  timeZone: string;
  ambiguity: "reject" | "earlier" | "later";
};
export function readCsv(text: string): string[][] {
  if (new TextEncoder().encode(text).byteLength > 20 * 1024 * 1024)
    throw new Error("CSV exceeds 20 MiB.");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (c === '"') {
      if (field || closed) throw new Error("Unexpected quote in CSV.");
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
      closed = false;
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
      closed = false;
    } else {
      if (closed && c.trim()) throw new Error("Text after a closing CSV quote.");
      field += c;
    }
    if (rows.length > 100001) throw new Error("CSV exceeds 100,000 set rows.");
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
const dateCache = new Map<string, { date: string; iso: string | null }>();
function sourceTime(raw: string, options: ImportOptions) {
  const key = JSON.stringify([raw, options.timeZone, options.ambiguity]);
  const cached = dateCache.get(key);
  if (cached) return cached;
  let text = raw.trim();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const named = text.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4}),? (\d{2}:\d{2}(?::\d{2})?)$/);
  if (named) {
    const month = months.findIndex((m) => m.toLowerCase() === named[2]!.toLowerCase());
    if (month < 0) throw new Error("Unknown month in workout timestamp.");
    text = `${named[3]}-${String(month + 1).padStart(2, "0")}-${named[1]!.padStart(2, "0")}T${named[4]}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    if (new Date(text + "T12:00:00Z").toISOString().slice(0, 10) !== text)
      throw new Error("Invalid calendar date.");
    const result = { date: text, iso: null };
    dateCache.set(key, result);
    return result;
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(text)) {
    const d = new Date(text.replace(" ", "T"));
    if (!Number.isFinite(d.getTime())) throw new Error("Invalid timestamp.");
    return { date: activityDay(d), iso: d.toISOString() };
  }
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match)
    throw new Error(
      "Unsupported date format. Use an unedited export and confirm its source time zone.",
    );
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const wall = Date.UTC(year!, month! - 1, day!, hour!, minute!, second || 0);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const target = `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6] ?? "00"}`;
  const candidates: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const time = wall - offset * 60000;
    const p = Object.fromEntries(formatter.formatToParts(time).map((p) => [p["type"], p["value"]]));
    if (
      `${p["year"]}-${p["month"]}-${p["day"]} ${p["hour"]}:${p["minute"]}:${p["second"]}` === target
    )
      candidates.push(time);
  }
  if (!candidates.length) throw new Error("Workout time does not exist in the selected time zone.");
  if (candidates.length > 1 && options.ambiguity === "reject")
    throw new Error(
      "Ambiguous daylight-saving timestamp. Explicitly select earlier or later occurrence.",
    );
  const d = new Date(
    options.ambiguity === "later" ? Math.max(...candidates) : Math.min(...candidates),
  );
  const result = { date: activityDay(d), iso: d.toISOString() };
  dateCache.set(key, result);
  return result;
}
const signatures = {
  strong: ["date", "workout name", "exercise name", "set order", "weight", "reps"],
  hevy: ["title", "start_time", "exercise_title", "set_index", "reps"],
  fitnotes: ["date", "exercise", "category", "weight", "reps"],
} as const;
function decimal(raw: string, label: string, max: number) {
  if (!raw.trim()) return null;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim())) throw new Error(`Invalid ${label}: ${raw}`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`Invalid ${label}.`);
  return n;
}
export function parseTrainingCsv(
  text: string,
  options: ImportOptions,
  onProgress?: (rows: number) => void,
): ImportWorkout[] {
  dateCache.clear();
  new Intl.DateTimeFormat("en", { timeZone: options.timeZone });
  const csv = readCsv(text);
  if (csv.length < 2) throw new Error("CSV has no workout rows.");
  const header = csv.shift()!.map((h) => h.trim().toLowerCase());
  if (!signatures[options.provider].every((h) => header.includes(h)))
    throw new Error("Unknown export headers for this provider. This file has not been imported.");
  if (
    options.provider === "hevy" &&
    !header.includes("weight_kg") &&
    !header.includes("weight_lbs")
  )
    throw new Error("Unsupported Hevy weight header.");
  const groups = new Map<string, ImportWorkout>();
  csv.forEach((row, index) => {
    if (row.length !== header.length)
      throw new Error(`Row ${index + 2}: inconsistent column count.`);
    const r = Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""]));
    const name = (r["exercise_title"] ?? r["exercise name"] ?? r["exercise"] ?? "").trim();
    if (!name) throw new Error(`Row ${index + 2}: exercise name is empty.`);
    const stamp = sourceTime(r["start_time"] ?? r["date"] ?? "", options);
    const title = r["title"] ?? r["workout name"] ?? "FitNotes workout";
    const groupKey = JSON.stringify([stamp.iso ?? stamp.date, title]);
    let w = groups.get(groupKey);
    if (!w) {
      w = {
        title,
        activity_date: stamp.date,
        started_at: stamp.iso,
        finished_at: r["end_time"] ? sourceTime(r["end_time"], options).iso : stamp.iso,
        source_rows: [],
        sets: [],
        warnings: [],
      };
      if (!stamp.iso)
        w.warnings.push(
          "Date-only export: workouts on this date are grouped; original time and duration are unknown.",
        );
      groups.set(groupKey, w);
    }
    w.source_rows.push(r);
    const note = r["notes"] ?? r["exercise_notes"] ?? "";
    const sessionNote = r["description"] ?? r["workout notes"] ?? "";
    const combined = [
      ...(w.notes?.split("\n") ?? []),
      sessionNote,
      note ? `${name}: ${note}` : "",
    ].filter(Boolean);
    w.notes = [...new Set(combined)].join("\n");
    if (w.notes.length > 10000)
      throw new Error(
        "Workout notes exceed 10,000 characters; review this export before importing.",
      );
    const distance = decimal(
      r["distance_km"] ?? r["distance_miles"] ?? r["distance"] ?? "",
      "distance",
      1000000,
    );
    if (distance) {
      w.warnings.push(`Unsupported distance/cardio row: ${name}. Explicit exclusion required.`);
      return;
    }
    const duration = decimal(
        r["duration_seconds"] ?? r["seconds"] ?? r["time"] ?? "",
        "duration",
        86400,
      ),
      reps = decimal(r["reps"] ?? "", "reps", 1000);
    if (
      (duration != null && !Number.isInteger(duration)) ||
      (reps != null && !Number.isInteger(reps))
    )
      throw new Error("Reps and seconds must be whole numbers.");
    if (!duration && !reps) {
      w.warnings.push(`Empty or unsupported row: ${name}. Explicit exclusion required.`);
      return;
    }
    const rawWeight = decimal(
      r["weight_kg"] ?? r["weight_lbs"] ?? r["weight"] ?? "",
      "weight",
      2204.63,
    );
    const pounds =
      header.includes("weight_lbs") || (!header.includes("weight_kg") && options.units === "lb");
    const weight =
      rawWeight == null ? null : Math.round(rawWeight * (pounds ? 0.45359237 : 1) * 100) / 100;
    if (weight != null && weight > 1000) throw new Error("Converted weight exceeds 1000 kg.");
    const type = (r["set_type"] ?? r["set type"] ?? "normal").toLowerCase();
    if (!["normal", "working", "warmup", "warm-up", "dropset", "drop", "failure"].includes(type))
      throw new Error(`Unsupported set type: ${type}`);
    const role =
      type === "warmup" || type === "warm-up"
        ? "warmup"
        : type === "dropset" || type === "drop"
          ? "drop"
          : "working";
    const previous = [...w.sets]
      .reverse()
      .find((s) => s.source_exercise === name && s.set_role === "working");
    if (role === "drop" && !previous)
      throw new Error("A drop set has no preceding root working set.");
    const rpe = decimal(r["rpe"] ?? "", "RPE", 10);
    if (rpe != null && rpe < 1) throw new Error("RPE must be 1–10 when provided.");
    w.sets.push({
      id: crypto.randomUUID(),
      source_exercise: name,
      exercise_id: "",
      set_number:
        Number(
          r["set order"] ??
            r["set_index"] ??
            w.sets.filter((s) => s.source_exercise === name).length + 1,
        ) + (options.provider === "hevy" ? 1 : 0),
      reps: duration ? null : reps,
      weight_kg: weight,
      rpe,
      duration_seconds: duration || null,
      logging_mode: duration ? "timed" : "weighted_reps",
      set_role: role,
      side: "bilateral",
      pair_id: null,
      root_set_id: role === "drop" ? previous!.id : null,
      segment_index:
        role === "drop" ? w.sets.filter((s) => s.root_set_id === previous!.id).length + 1 : 0,
      load_convention: "external_total",
      slot_key: "",
    });
    if (index % 1000 === 0) onProgress?.(index);
  });
  return [...groups.values()].map((w) => ({
    ...w,
    source_rows: w.source_rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  }));
}
export function exactExerciseMapping(
  names: string[],
  exercises: { id: string; name_en: string; name_ar: string | null; aliases?: string[] }[],
) {
  const result: Record<string, string> = {};
  for (const name of names) {
    const hits = exercises.filter((e) =>
      [e.name_en, e.name_ar ?? "", ...(e.aliases ?? [])].some(
        (n) => normalizeExercise(n) === normalizeExercise(name),
      ),
    );
    if (hits.length === 1) result[name] = hits[0]!.id;
  }
  return result;
}
