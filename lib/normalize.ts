/** BR-04: student codes are compared after trim + uppercase. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Tests a normalized code against the event's `studentCodePattern`. Patterns are
 * validated when saved, but a broken stored pattern must never crash submission.
 */
export function matchesStudentCodePattern(code: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(code);
  } catch {
    return false;
  }
}

/** True when `pattern` compiles as a JavaScript regular expression. */
export function isValidRegexPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
