import { describe, expect, it } from "vitest";
import { computeStats, type RatingInput } from "./stats";

let clock = 0;
function rating(score: number, overrides: Partial<RatingInput> = {}): RatingInput {
  clock += 1;
  const code = overrides.studentCode ?? `SV${clock}`;
  return {
    score,
    studentCode: code,
    studentName: `Name ${code}`,
    createdAt: new Date(clock * 1000),
    excluded: false,
    flags: [],
    ...overrides,
  };
}

const TRIM = 0.1;

describe("computeStats", () => {
  it("returns empty stats for n = 0", () => {
    expect(computeStats([], TRIM)).toEqual({
      n: 0,
      mean: null,
      trimmedMean: null,
      median: null,
      stdDev: null,
      highest: null,
      lowest: null,
      histogram: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      flaggedCount: 0,
      excludedCount: 0,
    });
  });

  it("handles n = 1 (stdDev is null below 2 ratings)", () => {
    const stats = computeStats([rating(7.5, { studentCode: "SV1", studentName: "An" })], TRIM);

    expect(stats.n).toBe(1);
    expect(stats.mean).toBe(7.5);
    expect(stats.trimmedMean).toBe(7.5);
    expect(stats.median).toBe(7.5);
    expect(stats.stdDev).toBeNull();
    expect(stats.highest).toEqual({ score: 7.5, raters: [{ code: "SV1", name: "An" }] });
  });

  it("handles all equal scores", () => {
    const stats = computeStats([rating(8, { studentCode: "A" }), rating(8, { studentCode: "B" }), rating(8, { studentCode: "C" })], TRIM);

    expect(stats.mean).toBe(8);
    expect(stats.trimmedMean).toBe(8);
    expect(stats.stdDev).toBe(0);
    expect(stats.highest?.raters.map((r) => r.code)).toEqual(["A", "B", "C"]);
    expect(stats.lowest?.raters.map((r) => r.code)).toEqual(["A", "B", "C"]);
  });

  it("computes the sample standard deviation (n - 1)", () => {
    const stats = computeStats([rating(2), rating(4), rating(4), rating(4), rating(5), rating(5), rating(7), rating(9)], TRIM);
    // mean 5, sum of squared deviations 32, n - 1 = 7
    expect(stats.stdDev).toBeCloseTo(Math.sqrt(32 / 7), 12);
  });

  it("puts a score of 10 into bucket 10 and uses floor for the others", () => {
    const stats = computeStats([rating(10), rating(9.5), rating(0), rating(0.5), rating(10)], TRIM);
    expect(stats.histogram).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2]);
  });

  it("trims nothing for n = 9 with ratio 0.1 (k = 0)", () => {
    const scores = [1, 5, 5, 6, 6, 7, 7, 8, 10];
    const stats = computeStats(scores.map((s) => rating(s)), TRIM);
    expect(stats.trimmedMean).toBeCloseTo(55 / 9, 12);
  });

  it("trims one value from each end for n = 10 with ratio 0.1 (k = 1)", () => {
    const scores = [0, 5, 5, 6, 6, 7, 7, 8, 8, 10];
    const stats = computeStats(scores.map((s) => rating(s)), TRIM);
    expect(stats.trimmedMean).toBeCloseTo((5 + 5 + 6 + 6 + 7 + 7 + 8 + 8) / 8, 12);
    expect(stats.mean).toBeCloseTo(6.2, 12);
  });

  it("falls back to the mean when trimming would remove everything", () => {
    const stats = computeStats([rating(2), rating(8)], 0.5);
    expect(stats.trimmedMean).toBe(5);
  });

  it("returns every rater tied on max/min, ordered by createdAt", () => {
    const late = rating(10, { studentCode: "LATE", createdAt: new Date(5000) });
    const early = rating(10, { studentCode: "EARLY", createdAt: new Date(1000) });
    const low1 = rating(2, { studentCode: "L1", createdAt: new Date(3000) });
    const low2 = rating(2, { studentCode: "L2", createdAt: new Date(2000) });
    const stats = computeStats([late, low1, rating(6), early, low2], TRIM);

    expect(stats.highest?.raters.map((r) => r.code)).toEqual(["EARLY", "LATE"]);
    expect(stats.lowest?.raters.map((r) => r.code)).toEqual(["L2", "L1"]);
  });

  it("ignores excluded ratings in every score statistic but counts them", () => {
    const stats = computeStats(
      [
        rating(8),
        rating(6),
        rating(0, { excluded: true, flags: ["DEVICE_MULTI_STUDENT"] }),
        rating(7, { flags: ["NAME_MISMATCH"] }),
      ],
      TRIM,
    );

    expect(stats.n).toBe(3);
    expect(stats.mean).toBe(7);
    expect(stats.lowest?.score).toBe(6);
    expect(stats.histogram[0]).toBe(0);
    expect(stats.excludedCount).toBe(1);
    expect(stats.flaggedCount).toBe(2);
  });

  it("does not mutate the input array", () => {
    const ratings = [rating(9), rating(1), rating(5)];
    const before = ratings.map((r) => r.score);
    computeStats(ratings, TRIM);
    expect(ratings.map((r) => r.score)).toEqual(before);
  });
});
