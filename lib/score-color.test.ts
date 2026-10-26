import { describe, expect, it } from "vitest";
import { scoreTier } from "./score-color";

describe("scoreTier", () => {
  it.each([
    [0, "low"],
    [4.5, "low"],
    [5, "mid"],
    [6.5, "mid"],
    [7, "high"],
    [8.5, "high"],
    [9, "top"],
    [10, "top"],
  ] as const)("maps %s to %s on the 0–10 scale", (score, tier) => {
    expect(scoreTier(score)).toBe(tier);
  });

  it("normalises a custom range to the 0–10 thresholds", () => {
    expect(scoreTier(4.5, 0, 5)).toBe("top"); // 9 on a 0–10 scale
    expect(scoreTier(2, 0, 5)).toBe("low"); // 4
  });
});
