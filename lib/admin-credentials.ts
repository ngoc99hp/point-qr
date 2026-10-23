import { createHash, timingSafeEqual } from "node:crypto";

export interface Credentials {
  email: string;
  password: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Checks a login attempt against the single configured admin account (SPEC §9.5).
 * Passwords are compared as fixed-length SHA-256 digests with timingSafeEqual,
 * so the comparison time does not depend on where or whether they differ.
 */
export function verifyAdminCredentials(attempt: Credentials, admin: Credentials): boolean {
  const isPasswordMatch = timingSafeEqual(sha256(attempt.password), sha256(admin.password));
  const isEmailMatch = normalizeEmail(attempt.email) === normalizeEmail(admin.email);
  return isPasswordMatch && isEmailMatch;
}
