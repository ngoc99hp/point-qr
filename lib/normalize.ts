/** BR-04: student codes are compared after trim + uppercase. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** The whole code must match, even if the lecturer's pattern is not anchored. */
function compileAnchored(pattern: string): RegExp {
  return new RegExp(`^(?:${pattern})$`);
}

/**
 * Tests a normalized code against the event's `studentCodePattern`. Patterns are
 * validated when saved, but a broken stored pattern must never crash submission.
 */
export function matchesStudentCodePattern(code: string, pattern: string): boolean {
  try {
    return compileAnchored(pattern).test(code);
  } catch {
    return false;
  }
}

const QUANTIFIER = String.raw`(?:[+*]|\{\d+(?:,\d*)?\})`;
const GROUP_BODY = String.raw`(?:[^()\\]|\\.)*`;
/** A group that contains a quantifier and is itself quantified, e.g. (a+)+ or ([A-Z]*){2,}. */
const NESTED_QUANTIFIER = new RegExp(String.raw`\(${GROUP_BODY}${QUANTIFIER}${GROUP_BODY}\)\s*${QUANTIFIER}`);
const LOOKAROUND = /\(\?<?[=!]/;
const BACKREFERENCE = /\\[1-9]|\\k</;

/**
 * Patterns run on public input (submitRating), so reject constructs that can cause
 * catastrophic backtracking (ReDoS): nested quantifiers, lookarounds, backreferences.
 */
export function isSafeStudentCodePattern(pattern: string): boolean {
  if (NESTED_QUANTIFIER.test(pattern) || LOOKAROUND.test(pattern) || BACKREFERENCE.test(pattern)) {
    return false;
  }
  try {
    compileAnchored(pattern);
    return true;
  } catch {
    return false;
  }
}
