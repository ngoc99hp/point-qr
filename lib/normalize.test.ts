import { describe, expect, it } from "vitest";
import { matchesStudentCodePattern, normalizeCode } from "./normalize";

describe("normalizeCode (BR-04)", () => {
  it("trims and uppercases", () => {
    expect(normalizeCode("  sv12345 ")).toBe("SV12345");
  });

  it("keeps inner characters as typed", () => {
    expect(normalizeCode("ab-12")).toBe("AB-12");
  });
});

describe("matchesStudentCodePattern", () => {
  const DEFAULT_PATTERN = "^[A-Z0-9]{5,15}$";

  it("accepts a normalized code matching the pattern", () => {
    expect(matchesStudentCodePattern("SV12345", DEFAULT_PATTERN)).toBe(true);
  });

  it("rejects codes that are too short, too long or contain other characters", () => {
    expect(matchesStudentCodePattern("SV12", DEFAULT_PATTERN)).toBe(false);
    expect(matchesStudentCodePattern("A".repeat(16), DEFAULT_PATTERN)).toBe(false);
    expect(matchesStudentCodePattern("SV-12345", DEFAULT_PATTERN)).toBe(false);
  });

  it("treats an invalid stored pattern as no match instead of throwing", () => {
    expect(matchesStudentCodePattern("SV12345", "([")).toBe(false);
  });
});
