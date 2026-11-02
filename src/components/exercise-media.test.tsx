import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ locale: "en" }) }));
vi.mock("@/hooks/use-exercise-visual", () => ({
  useExerciseVisual: (e: ExerciseGuidance | undefined, enabled = true) =>
    enabled && e?.editorial_status === "reviewed" ? e.media : null,
}));
import { ExerciseThumbnail } from "./exercise-thumbnail";
import { ExerciseDemonstration } from "./exercise-demonstration";
import { exerciseMediaKind, exercisePoster, safeExerciseAsset } from "@/lib/exercise-media";
import { mergeExerciseSnapshots } from "@/lib/training-tools";
import { exerciseWithSnapshot, type ExerciseGuidance } from "@/lib/exercise-guidance";

const exercise: ExerciseGuidance = {
  id: "bench",
  name_en: "Bench press",
  name_ar: null,
  muscle: "chest",
  equipment: "barbell",
  editorial_status: "reviewed",
  media: {
    url: "https://media.test.invalid/bench.gif",
    poster: "https://media.test.invalid/bench.webp",
    author: "Coach",
    source: "Licensed collection",
    license: "Licensed",
    permission: "Recorded",
    attribution: "Exercise creator",
  },
};
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("requires safe URLs and a reviewed static poster", () => {
  expect(safeExerciseAsset("javascript:alert(1)")).toBeNull();
  expect(safeExerciseAsset("//other.invalid/image.png")).toBeNull();
  expect(safeExerciseAsset("http://other.invalid/image.png")).toBeNull();
  expect(safeExerciseAsset("/images/bench.webp")).toBe("/images/bench.webp");
  expect(exercisePoster(exercise)).toBe(exercise.media!.poster);
  expect(exercisePoster({ ...exercise, editorial_status: "pending" })).toBeNull();
  expect(
    exercisePoster({
      ...exercise,
      media: { ...exercise.media!, poster: "https://media.test.invalid/animated.gif" },
    }),
  ).toBeNull();
  expect(
    exerciseMediaKind({
      ...exercise.media!,
      url: "https://media.test.invalid/bench.GIF?revision=2",
    }),
  ).toBe("gif");
});
it("keeps catalogue media while overlaying frozen exercise labels", () => {
  const result = mergeExerciseSnapshots(
    [exercise],
    [
      {
        id: exercise.id,
        name_en: "Frozen bench",
        name_ar: null,
        muscle: "chest",
        equipment: "barbell",
      },
    ],
  ) as ExerciseGuidance[];
  expect(result[0]!.name_en).toBe("Frozen bench");
  expect(result[0]!.media).toEqual(exercise.media);
});
it("uses frozen names and measurement conventions while retaining current approved media", () => {
  const merged = exerciseWithSnapshot(
    exercise.id,
    {
      name_en: "Old dumbbell press",
      name_ar: null,
      equipment: null,
      logging_mode: "bodyweight_reps",
      load_convention: "per_hand",
      media: { url: "https://old.invalid/unreviewed.gif" },
    },
    exercise,
  );
  expect(merged.name_en).toBe("Old dumbbell press");
  expect(merged.name_ar).toBe("Old dumbbell press");
  expect(merged.load_convention).toBe("per_hand");
  expect(merged.logging_mode).toBe("bodyweight_reps");
  expect(merged.equipment).toBeNull();
  expect(merged.media).toEqual(exercise.media);
});
it("can display archived snapshots and unlinked legacy rows without inventing media", () => {
  const archived = exerciseWithSnapshot("archived", { name_en: "Old hold", logging_mode: "timed" });
  expect(archived.name_en).toBe("Old hold");
  expect(archived.logging_mode).toBe("timed");
  expect(exercisePoster(archived)).toBeNull();
  const legacy = exerciseWithSnapshot("unknown", null);
  expect(legacy.name_en).toBe("Historical exercise");
  expect(legacy.media).toBeUndefined();
});
it("loads only the thumbnail poster and keeps guidance reachable after a poster failure", () => {
  const open = vi.fn();
  act(() =>
    root.render(<ExerciseThumbnail exercise={exercise} name="Bench press" onOpen={open} />),
  );
  expect(host.querySelector("img")?.getAttribute("src")).toBe(exercise.media!.poster);
  act(() => host.querySelector("img")!.dispatchEvent(new Event("error")));
  expect(host.querySelector("img")).toBeNull();
  act(() => host.querySelector("button")!.click());
  expect(open).toHaveBeenCalledOnce();
});
it("loads GIFs on request and stops them by unmounting the animated image", () => {
  act(() => root.render(<ExerciseDemonstration exercise={exercise} />));
  expect(host.querySelector("img")?.getAttribute("src")).toBe(exercise.media!.poster);
  act(() => host.querySelector("button")!.click());
  expect(host.querySelector("img")?.getAttribute("src")).toBe(exercise.media!.url);
  expect(host.querySelector("video")).toBeNull();
  act(() => host.querySelector("button")!.click());
  expect(host.querySelector("img")?.getAttribute("src")).toBe(exercise.media!.poster);
});
it("honors reduced motion even when opening from a thumbnail", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  act(() => root.render(<ExerciseDemonstration exercise={exercise} startMedia />));
  expect(host.querySelector("img")?.getAttribute("src")).toBe(exercise.media!.poster);
  act(() => host.querySelector("button")!.click());
  expect(host.querySelector("img")?.getAttribute("src")).toBe(exercise.media!.url);
});
it("retains written-guidance fallback and requires an explicit retry after failed media", () => {
  act(() => root.render(<ExerciseDemonstration exercise={exercise} startMedia />));
  act(() => host.querySelector("img")!.dispatchEvent(new Event("error")));
  expect(host.querySelector('[role="alert"]')).toHaveTextContent("Could not load");
  expect(host.querySelector("button")).toHaveTextContent("Retry demonstration");
  expect(host.querySelector("img")?.getAttribute("src")).toBe(exercise.media!.poster);
  act(() => host.querySelector("button")!.click());
  expect(host.querySelector("img")?.getAttribute("src")).toBe(exercise.media!.url);
});
it("uses image rendering for still assets and native controls for video", () => {
  act(() =>
    root.render(
      <ExerciseDemonstration
        exercise={{
          ...exercise,
          media: { ...exercise.media!, url: "https://media.test.invalid/bench.png" },
        }}
        startMedia
      />,
    ),
  );
  expect(host.querySelector("img")?.getAttribute("src")).toContain("bench.png");
  act(() =>
    root.render(
      <ExerciseDemonstration
        key="video"
        exercise={{
          ...exercise,
          media: { ...exercise.media!, url: "https://media.test.invalid/bench.mp4" },
        }}
        startMedia
      />,
    ),
  );
  expect(host.querySelector("video")).toHaveAttribute("controls");
  expect(host.querySelector("video")).toHaveAttribute("playsinline");
});
