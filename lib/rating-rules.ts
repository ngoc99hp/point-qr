import { namesMatch } from "@/lib/normalize";
import type { RatingFlag } from "@/lib/types/rating";

export interface RosterStudent {
  id: string;
  fullName: string;
  groupId: string | null;
}

export type RosterDecision =
  | { ok: false; code: "NOT_IN_ROSTER" | "SELF_RATING" }
  | { ok: true; unknownStudent: boolean };

/** BR-08 (roster membership) then BR-07 (no rating your own group). */
export function evaluateRoster(input: {
  student: RosterStudent | null;
  strictRoster: boolean;
  ratedGroupId: string;
}): RosterDecision {
  if (!input.student) {
    return input.strictRoster ? { ok: false, code: "NOT_IN_ROSTER" } : { ok: true, unknownStudent: true };
  }
  if (input.student.groupId === input.ratedGroupId) return { ok: false, code: "SELF_RATING" };
  return { ok: true, unknownStudent: false };
}

export interface FlagDecision {
  flags: RatingFlag[];
  excluded: boolean;
  excludedBy: string | null;
}

export const AUTO_EXCLUDED_BY = "AUTO";

/**
 * Recomputes flags from scratch on every (re)submission (SPEC §14 P2):
 * UNKNOWN_STUDENT and NAME_MISMATCH only flag; DEVICE_MULTI_STUDENT also
 * auto-excludes (D5). A manual exclusion by the lecturer always survives.
 */
export function evaluateFlags(input: {
  unknownStudent: boolean;
  enteredName: string;
  rosterName: string | null;
  deviceUsedByOtherStudent: boolean;
  previous: { excluded: boolean; excludedBy: string | null } | null;
}): FlagDecision {
  const flags: RatingFlag[] = [];
  if (input.unknownStudent) flags.push("UNKNOWN_STUDENT");
  if (input.rosterName !== null && !namesMatch(input.enteredName, input.rosterName)) {
    flags.push("NAME_MISMATCH");
  }
  if (input.deviceUsedByOtherStudent) flags.push("DEVICE_MULTI_STUDENT");

  const previous = input.previous;
  if (previous?.excluded && previous.excludedBy && previous.excludedBy !== AUTO_EXCLUDED_BY) {
    return { flags, excluded: true, excludedBy: previous.excludedBy };
  }
  return input.deviceUsedByOtherStudent
    ? { flags, excluded: true, excludedBy: AUTO_EXCLUDED_BY }
    : { flags, excluded: false, excludedBy: null };
}
