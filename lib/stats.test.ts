import { describe, expect, it } from "vitest";
import { computeStats, type RatingInput } from "./stats";

let clock = 0;
function rating(score: number, code = `SV${score}-${clock}`, name = `Name ${code}`): RatingInput {
  clock += 1;
  return { score, studentCode: code, studentName: name, createdAt: new Date(clock * 1000) };
}

describe("computeStats", () => {
  it("returns empty stats for n = 0", () => {
    expect(computeStats([])).toEqual({
      n: 0,
      mean: null,
      median: null,
      highest: null,
      lowest: null,
    });
  });

  it("handles n = 1", () => {
    const only = rating(7.5, "SV1", "An");
    const stats = computeStats([only]);

    expect(stats.n).toBe(1);
    expect(stats.mean).toBe(7.5);
    expect(stats.median).toBe(7.5);
    expect(stats.highest).toEqual({ score: 7.5, raters: [{ code: "SV1", name: "An" }] });
    expect(stats.lowest).toEqual({ score: 7.5, raters: [{ code: "SV1", name: "An" }] });
  });

  it("handles all equal scores: every rater is both highest and lowest", () => {
    const ratings = [rating(8, "A"), rating(8, "B"), rating(8, "C")];
    const stats = computeStats(ratings);

    expect(stats.mean).toBe(8);
    expect(stats.median).toBe(8);
    expect(stats.highest?.raters.map((r) => r.code)).toEqual(["A", "B", "C"]);
    expect(stats.lowest?.raters.map((r) => r.code)).toEqual(["A", "B", "C"]);
  });

  it("computes mean without rounding", () => {
    const stats = computeStats([rating(7), rating(8), rating(8)]);
    expect(stats.mean).toBeCloseTo(23 / 3, 12);
  });

  it("uses the middle value for odd n and the average of the two middle values for even n", () => {
    expect(computeStats([rating(9), rating(1), rating(5)]).median).toBe(5);
    expect(computeStats([rating(9), rating(1), rating(5), rating(6)]).median).toBe(5.5);
  });

  it("returns every rater tied on max/min, ordered by createdAt", () => {
    const late = { score: 10, studentCode: "LATE", studentName: "Late", createdAt: new Date(5000) };
    const early = { score: 10, studentCode: "EARLY", studentName: "Early", createdAt: new Date(1000) };
    const low1 = { score: 2, studentCode: "L1", studentName: "L1", createdAt: new Date(3000) };
    const low2 = { score: 2, studentCode: "L2", studentName: "L2", createdAt: new Date(2000) };
    const mid = { score: 6, studentCode: "M", studentName: "M", createdAt: new Date(4000) };

    const stats = computeStats([late, low1, mid, early, low2]);

    expect(stats.highest).toEqual({
      score: 10,
      raters: [
        { code: "EARLY", name: "Early" },
        { code: "LATE", name: "Late" },
      ],
    });
    expect(stats.lowest?.raters.map((r) => r.code)).toEqual(["L2", "L1"]);
  });

  it("does not mutate the input array", () => {
    const ratings = [rating(9), rating(1), rating(5)];
    const before = ratings.map((r) => r.score);

    computeStats(ratings);

    expect(ratings.map((r) => r.score)).toEqual(before);
  });
});
