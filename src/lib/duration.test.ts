import { describe, expect, it } from "vitest";
import { formatDuration } from "./duration";

describe("formatDuration", () => {
  it("keeps seconds under a minute and switches to m:ss from 60s", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(605.9)).toBe("10:05");
    expect(formatDuration(4500)).toBe("1:15:00");
    expect(formatDuration(-3)).toBe("0s");
  });
});
