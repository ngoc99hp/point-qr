import { describe, expect, it } from "vitest";
import { formatDateTime, formatScore } from "./format";

describe("formatScore", () => {
  it("rounds to 2 decimals for display with a Vietnamese decimal comma", () => {
    expect(formatScore(23 / 3)).toBe("7,67");
    expect(formatScore(8)).toBe("8");
    expect(formatScore(7.5)).toBe("7,5");
  });

  it("shows a dash for missing values", () => {
    expect(formatScore(null)).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("displays UTC instants in Asia/Ho_Chi_Minh (UTC+7)", () => {
    const formatted = formatDateTime(new Date("2026-10-23T01:05:00Z"));
    expect(formatted).toContain("08:05");
    expect(formatted).toContain("23/10/2026");
  });
});
