import { describe, expect, it } from "vitest";
import { isAllowedLecturer, normalizeEmail } from "./allowlist";

const ALLOWLIST = ["a@hpu.edu.vn", "b@hpu.edu.vn"];

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  A@HPU.edu.VN ")).toBe("a@hpu.edu.vn");
  });
});

describe("isAllowedLecturer", () => {
  it("allows a verified email in the allowlist regardless of case and spacing", () => {
    expect(
      isAllowedLecturer({ email: " A@Hpu.Edu.Vn ", emailVerified: true }, ALLOWLIST),
    ).toBe(true);
  });

  it("rejects an email that is not in the allowlist", () => {
    expect(
      isAllowedLecturer({ email: "c@hpu.edu.vn", emailVerified: true }, ALLOWLIST),
    ).toBe(false);
  });

  it("rejects an allowlisted email that Google has not verified", () => {
    expect(
      isAllowedLecturer({ email: "a@hpu.edu.vn", emailVerified: false }, ALLOWLIST),
    ).toBe(false);
    expect(
      isAllowedLecturer({ email: "a@hpu.edu.vn", emailVerified: null }, ALLOWLIST),
    ).toBe(false);
  });

  it("rejects a missing email", () => {
    expect(isAllowedLecturer({ email: null, emailVerified: true }, ALLOWLIST)).toBe(
      false,
    );
    expect(isAllowedLecturer({ email: undefined, emailVerified: true }, ALLOWLIST)).toBe(
      false,
    );
  });

  it("matches the full address, not the domain", () => {
    expect(
      isAllowedLecturer({ email: "x.a@hpu.edu.vn", emailVerified: true }, ALLOWLIST),
    ).toBe(false);
  });
});
