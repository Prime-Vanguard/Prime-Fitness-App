import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  referenceSchema,
  referenceSource,
  sourceFromGuidance,
  referenceEquipment,
  searchReferences,
} from "./exercise-reference";
const reference = referenceSchema.parse(
  JSON.parse(readFileSync("public/data/exercise-reference.json", "utf8")),
);
describe("licensed exercise reference", () => {
  it("vendors all 1324 unique text-only records and pins provenance", () => {
    expect(reference.exercises).toHaveLength(1324);
    expect(new Set(reference.exercises.map((r) => r.id)).size).toBe(1324);
    expect(reference.license).toBe("MIT");
    expect(reference.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(reference.exercises.every((r) => r.steps_en.length > 0)).toBe(true);
    const raw = JSON.stringify(reference);
    expect(raw).not.toContain('"gif_url"');
    expect(raw).not.toContain('"image"');
    expect(raw).not.toContain('"media_id"');
    expect(raw).not.toContain('"steps_ar"');
  });
  it("rejects accidental media in the MIT text bundle", () => {
    expect(() =>
      referenceSchema.parse({
        ...reference,
        exercises: [{ ...reference.exercises[0], gif_url: "https://example.com/not-mit.gif" }],
      }),
    ).toThrow();
  });
  it("keeps exact-name search first and filters by equipment", () => {
    const chosen = reference.exercises.find((r) => r.name === "barbell bench press")!;
    expect(chosen).toBeDefined();
    expect(searchReferences(reference.exercises, "BARBELL BENCH PRESS")[0]?.id).toBe(chosen.id);
    expect(searchReferences(reference.exercises, "kettlebell").length).toBeGreaterThan(10);
    expect(searchReferences(reference.exercises, "does-not-exist-at-all")).toEqual([]);
  });
  it("retains text licensing separately from exercise media", () => {
    const source = referenceSource(reference.exercises[0]!);
    expect(sourceFromGuidance({ text_source: source })).toEqual(source);
    expect(sourceFromGuidance({})).toBeNull();
    expect(sourceFromGuidance({ text_source: { ...source, exercise_id: "../escape" } })).toBeNull();
    const license = readFileSync("public/legal/exercise-dataset-LICENSE.txt", "utf8");
    expect(license).toContain("MIT License");
    expect(license).toContain("MEDIA EXCEPTION");
    expect(license).toContain("obtain your own");
  });
  it("normalizes only equipment and does not infer load or movement rules", () => {
    expect(referenceEquipment("body weight")).toBe("bodyweight");
    expect(referenceEquipment("leverage machine")).toBe("machine");
    expect(referenceEquipment("dumbbell")).toBe("dumbbell");
  });
});
