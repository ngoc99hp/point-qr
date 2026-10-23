/** BR-04: student codes are compared after trim + uppercase. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

const COMBINING_MARKS = /\p{M}/gu;

/**
 * BR-09: compare names without diacritics. NFD + strip combining marks, map đ/Đ
 * to d (NFD does not decompose it), lowercase and collapse whitespace.
 */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
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
