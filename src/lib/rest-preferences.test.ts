import { beforeEach, expect, it, vi } from "vitest";
import { readRestPreferences, restDefaults, saveRestPreferences } from "./rest-preferences";
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it("persists volume, mute and optional vibration", () => {
  saveRestPreferences({ volume: 0.9, muted: true, vibration: true });
  expect(readRestPreferences()).toEqual({ volume: 0.9, muted: true, vibration: true });
});
it("recovers malformed preferences and reports storage failure", () => {
  localStorage.setItem("pf-rest-alert", '{"volume":10}');
  expect(readRestPreferences()).toEqual(restDefaults);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  expect(() => saveRestPreferences(restDefaults)).toThrow("quota");
  expect(() => saveRestPreferences({ ...restDefaults, volume: NaN })).toThrow("volume");
});
