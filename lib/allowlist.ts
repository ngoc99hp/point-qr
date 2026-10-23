export interface SignInIdentity {
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * A lecturer may sign in only with a Google-verified email that exactly matches
 * an entry in the allowlist (entries are already normalized by lib/env).
 */
export function isAllowedLecturer(
  identity: SignInIdentity,
  allowlist: readonly string[],
): boolean {
  if (!identity.email || identity.emailVerified !== true) return false;
  return allowlist.includes(normalizeEmail(identity.email));
}
