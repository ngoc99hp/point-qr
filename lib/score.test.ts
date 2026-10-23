import { describe, expect, it } from "vitest";
import { isValidScore, scoreOptions } from "./score";

const DEFAULT_CONFIG = { minScore: 0, maxScore: 10, scoreStep: 0.5 };

describe("isValidScore (BR-05)", () => {
  it.each([0, 0.5, 7, 9.5, 10])("accepts %s with step 0.5", (score) => {
    expect(isValidScore(score, DEFAULT_CONFIG)).toBe(true);
  });

  it.each([0.3, 7.25, 9.9])("rejects %s that is not a multiple of 0.5", (score) => {
    expect(isValidScore(score, DEFAULT_CONFIG)).toBe(false);
  });

  it.each([-0.5, 10.5, 11])("rejects %s outside [min, max]", (score) => {
    expect(isValidScore(score, DEFAULT_CONFIG)).toBe(false);
  });

  it("handles step 0.1 without floating point errors", () => {
    const config = { ...DEFAULT_CONFIG, scoreStep: 0.1 };
    expect(isValidScore(0.3, config)).toBe(true); // 0.3 * 10 = 2.9999999999999996
    expect(isValidScore(0.7, config)).toBe(true);
    expect(isValidScore(9.9, config)).toBe(true);
    expect(isValidScore(0.35, config)).toBe(false);
  });

  it("handles step 1", () => {
    const config = { ...DEFAULT_CONFIG, scoreStep: 1 };
    expect(isValidScore(8, config)).toBe(true);
    expect(isValidScore(8.5, config)).toBe(false);
  });

  it("respects a narrower range", () => {
    const config = { minScore: 5, maxScore: 8, scoreStep: 0.5 };
    expect(isValidScore(4.5, config)).toBe(false);
    expect(isValidScore(5, config)).toBe(true);
    expect(isValidScore(8, config)).toBe(true);
    expect(isValidScore(8.5, config)).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("rejects %s", (score) => {
    expect(isValidScore(score, DEFAULT_CONFIG)).toBe(false);
  });
});

describe("scoreOptions", () => {
  it("lists every valid score from min to max", () => {
    expect(scoreOptions({ minScore: 0, maxScore: 2, scoreStep: 0.5 })).toEqual([
      0, 0.5, 1, 1.5, 2,
    ]);
  });

  it("produces 21 options for the default 0–10 step 0.5 config", () => {
    const options = scoreOptions(DEFAULT_CONFIG);
    expect(options).toHaveLength(21);
    expect(options.at(-1)).toBe(10);
  });

  it("produces clean decimals for step 0.1", () => {
    const options = scoreOptions({ minScore: 0, maxScore: 1, scoreStep: 0.1 });
    expect(options).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });

  it("only includes multiples of the step when min is not aligned", () => {
    expect(scoreOptions({ minScore: 0.3, maxScore: 2, scoreStep: 1 })).toEqual([1, 2]);
  });
});
