import { expect, it } from "vitest";
import {
  parseTrainingCsv,
  readCsv,
  exactExerciseMapping,
  type ImportOptions,
} from "./training-import";
const options: ImportOptions = {
  provider: "strong",
  units: "kg",
  timeZone: "Africa/Cairo",
  ambiguity: "reject",
};
const strong =
  'Date,Workout Name,Exercise Name,Set Order,Weight,Reps,Seconds,Notes\r\n2026-10-20 10:00:00,Legs,Squat,1,40,10,,"coach, says\nsteady"\r\n';
it("parses quoted multiline Strong CSV without losing a set", () => {
  const rows = parseTrainingCsv(strong, options);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.sets[0]).toMatchObject({
    reps: 10,
    weight_kg: 40,
    logging_mode: "weighted_reps",
  });
  expect(rows[0]?.started_at).toBe("2026-10-20T07:00:00.000Z");
});
it("imports Hevy warmups, drops and seconds while preserving the root", () => {
  const csv =
    'title,start_time,end_time,exercise_title,set_index,set_type,weight_lbs,reps,duration_seconds,rpe\nLegs,"20 Oct 2026, 10:00","20 Oct 2026, 11:00",Squat,0,normal,88.1849,12,,8\nLegs,"20 Oct 2026, 10:00","20 Oct 2026, 11:00",Squat,1,dropset,44.0925,8,,9\nLegs,"20 Oct 2026, 10:00","20 Oct 2026, 11:00",Plank,0,normal,0,,30,7';
  const w = parseTrainingCsv(csv, { ...options, provider: "hevy" })[0]!;
  expect(w.sets[0]?.weight_kg).toBe(40);
  expect(w.sets[1]?.root_set_id).toBe(w.sets[0]?.id);
  expect(w.sets[2]?.duration_seconds).toBe(30);
});
it("keeps FitNotes date-only history without inventing a duration", () => {
  const rows = parseTrainingCsv(
    "Date,Exercise,Category,Weight,Reps,Distance,Time\n2026-10-20,Press,Shoulders,20,10,,",
    { ...options, provider: "fitnotes" },
  );
  expect(rows[0]).toMatchObject({
    activity_date: "2026-10-20",
    started_at: null,
    finished_at: null,
  });
  expect(rows[0]?.warnings).not.toHaveLength(0);
});
it("requires explicit DST interpretation and rejects nonexistent times", () => {
  const csv = strong.replace("2026-10-20 10:00:00", "2026-11-01 01:30:00");
  expect(() => parseTrainingCsv(csv, { ...options, timeZone: "America/New_York" })).toThrow(
    "Ambiguous",
  );
  const early = parseTrainingCsv(csv, {
    ...options,
    timeZone: "America/New_York",
    ambiguity: "earlier",
  })[0]!.started_at;
  const late = parseTrainingCsv(csv, {
    ...options,
    timeZone: "America/New_York",
    ambiguity: "later",
  })[0]!.started_at;
  expect(new Date(late!).getTime() - new Date(early!).getTime()).toBe(3600000);
  expect(() =>
    parseTrainingCsv(strong.replace("2026-10-20 10:00:00", "2026-03-08 02:30:00"), {
      ...options,
      timeZone: "America/New_York",
    }),
  ).toThrow("does not exist");
});
it.each([
  strong.replace("Weight", "Unknown"),
  strong.replace(",40,10,", ",-40,10,"),
  strong.replace(",40,10,", ",NaN,10,"),
  strong.replace(",40,10,", ",40,2.5,"),
])("rejects unknown signatures and invalid values", (csv) =>
  expect(() => parseTrainingCsv(csv, options)).toThrow(),
);
it("does not execute formulas or guess fuzzy mappings", () => {
  expect(readCsv('Name\n"=1+1"')).toEqual([["Name"], ["=1+1"]]);
  expect(
    exactExerciseMapping(
      ["Back squat", "Sqat"],
      [{ id: "s", name_en: "Squat", name_ar: null, aliases: ["back squat"] }],
    ),
  ).toEqual({ "Back squat": "s" });
});
it("reports unsupported cardio instead of silently treating it as strength", () => {
  const csv = "Date,Exercise,Category,Weight,Reps,Distance,Time\n2026-10-20,Run,Cardio,,,5,1200";
  const w = parseTrainingCsv(csv, { ...options, provider: "fitnotes" })[0]!;
  expect(w.sets).toHaveLength(0);
  expect(w.warnings.some((w) => w.includes("Explicit exclusion required"))).toBe(true);
});
it("rejects broken CSV quotes and inconsistent columns", () => {
  expect(() => readCsv('a\n"unclosed')).toThrow();
  expect(() => parseTrainingCsv(strong.replace(",40,10,,", ",40,10,,,extra,"), options)).toThrow();
});
