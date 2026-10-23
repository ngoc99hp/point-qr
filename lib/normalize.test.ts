import { describe, expect, it } from "vitest";
import {
  isSafeStudentCodePattern,
  matchesStudentCodePattern,
  namesMatch,
  normalizeCode,
  normalizeName,
} from "./normalize";

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

  it("matches the whole code even when the pattern is not anchored", () => {
    expect(matchesStudentCodePattern("ABC12345678", "\\d{8}")).toBe(false);
    expect(matchesStudentCodePattern("12345678", "\\d{8}")).toBe(true);
    expect(matchesStudentCodePattern("SV1", "SV1|SV2")).toBe(true);
    expect(matchesStudentCodePattern("XSV1", "SV1|SV2")).toBe(false);
  });
});

describe("normalizeName / namesMatch (BR-09)", () => {
  it("removes diacritics, maps đ/Đ to d, lowercases and collapses spaces", () => {
    expect(normalizeName("  Đào   Anh  Ngọc ")).toBe("dao anh ngoc");
    expect(normalizeName("NGUYỄN THỊ HƯƠNG")).toBe("nguyen thi huong");
  });

  it('treats "Đào Anh Ngọc" and "dao anh ngoc" as the same name', () => {
    expect(namesMatch("Đào Anh Ngọc", "dao anh ngoc")).toBe(true);
  });

  it("detects a different name", () => {
    expect(namesMatch("Đào Anh Ngọc", "Đào Anh Ngân")).toBe(false);
  });

  it("handles composed and decomposed Unicode the same way", () => {
    expect(namesMatch("Ngọc".normalize("NFC"), "Ngọc".normalize("NFD"))).toBe(true);
  });
});

describe("isSafeStudentCodePattern", () => {
  it.each(["^[A-Z0-9]{5,15}$", "\\d{8}", "^(SV|GV)\\d{6}$", "[A-Z]{2}\\d+"])(
    "accepts %s",
    (pattern) => {
      expect(isSafeStudentCodePattern(pattern)).toBe(true);
    },
  );

  it.each(["(a+)+$", "^(\\d*)*$", "(x+){2,}", "([A-Z]+)*", "(", "(?<=A)B"])(
    "rejects invalid or catastrophic-backtracking pattern %s",
    (pattern) => {
      expect(isSafeStudentCodePattern(pattern)).toBe(false);
    },
  );
});
