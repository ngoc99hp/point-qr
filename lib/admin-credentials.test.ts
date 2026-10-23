import { describe, expect, it } from "vitest";
import { normalizeEmail, verifyAdminCredentials } from "./admin-credentials";

const ADMIN = { email: "admin@hpu.edu.vn", password: "correct-horse-battery-staple" };

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Admin@HPU.edu.VN ")).toBe("admin@hpu.edu.vn");
  });
});

describe("verifyAdminCredentials", () => {
  it("accepts the configured email (any case/spacing) with the exact password", () => {
    expect(
      verifyAdminCredentials({ email: " ADMIN@hpu.edu.vn ", password: ADMIN.password }, ADMIN),
    ).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(
      verifyAdminCredentials({ email: ADMIN.email, password: `${ADMIN.password}x` }, ADMIN),
    ).toBe(false);
    expect(verifyAdminCredentials({ email: ADMIN.email, password: "" }, ADMIN)).toBe(false);
  });

  it("treats the password as case- and whitespace-sensitive", () => {
    expect(
      verifyAdminCredentials(
        { email: ADMIN.email, password: ADMIN.password.toUpperCase() },
        ADMIN,
      ),
    ).toBe(false);
    expect(
      verifyAdminCredentials({ email: ADMIN.email, password: ` ${ADMIN.password}` }, ADMIN),
    ).toBe(false);
  });

  it("rejects another email even with the right password", () => {
    expect(
      verifyAdminCredentials({ email: "other@hpu.edu.vn", password: ADMIN.password }, ADMIN),
    ).toBe(false);
  });
});
