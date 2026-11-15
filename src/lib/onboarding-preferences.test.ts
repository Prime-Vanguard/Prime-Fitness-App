import { expect, it } from "vitest";
import { emptyTrainingPreferences, parseTrainingPreferences } from "./onboarding-preferences";

it("keeps optional answers unspecified rather than inventing a training baseline", () => {
  expect(parseTrainingPreferences(emptyTrainingPreferences())).toEqual({
    goals: [],
    equipment: [],
    experience: null,
    weekly_days: null,
  });
});
it("rejects invalid, duplicated and unexpected preference values", () => {
  for (const patch of [
    { weekly_days: 0 },
    { weekly_days: 8 },
    { weekly_days: 2.5 },
    { weekly_days: "3" },
    { goals: ["strength", "strength"] },
    { equipment: ["unknown"] },
    { experience: "expert" },
    { access_active: true },
  ])
    expect(() => parseTrainingPreferences({ ...emptyTrainingPreferences(), ...patch })).toThrow();
});
