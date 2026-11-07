import { beforeEach, expect, it, vi } from "vitest";
import { saveRestPreferences } from "./rest-preferences";
beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.unstubAllGlobals();
});
it("plays three preview tones at the stored volume and respects mute", async () => {
  const levels: number[] = [],
    tones: unknown[] = [];
  class Context {
    state = "running";
    currentTime = 0;
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    createOscillator() {
      const oscillator = {
        frequency: { value: 0 },
        type: "",
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      };
      tones.push(oscillator);
      return oscillator;
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: (value: number) => levels.push(value),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }
  }
  vi.stubGlobal("AudioContext", Context);
  const { primeAudio, restSound } = await import("./device-feedback");
  saveRestPreferences({ volume: 0.8, muted: false, vibration: false });
  await primeAudio();
  restSound();
  expect(tones).toHaveLength(3);
  expect(levels).toHaveLength(3);
  for (const level of levels) expect(level).toBeCloseTo(0.28);
  saveRestPreferences({ volume: 1, muted: true, vibration: false });
  restSound();
  expect(tones).toHaveLength(3);
});
it("does not interrupt logging when browser audio is blocked", async () => {
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        throw new Error("Blocked");
      }
    },
  );
  const { primeAudio, restSound } = await import("./device-feedback");
  await expect(primeAudio()).resolves.toBeUndefined();
  expect(() => restSound()).not.toThrow();
});
