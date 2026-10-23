import "server-only";
import { db } from "@/lib/db";
import { matchesStudentCodePattern } from "@/lib/normalize";
import { evaluateRoster } from "@/lib/rating-rules";
import { passTicketGate } from "@/lib/ratings/ticket-gate";

export type StudentCodeStatus =
  | "OK"
  | "INVALID_FORMAT"
  | "NOT_IN_ROSTER"
  | "SELF_RATING"
  | "ROUND_CLOSED"
  | "TICKET_EXPIRED"
  | "RATE_LIMITED";

/**
 * D4: early feedback while the student types. Requires a valid ticket and is rate
 * limited per device (P3), so it cannot be used to enumerate the roster from outside
 * the classroom. Returns only a status — never roster names or groups (SPEC §9.5).
 */
export async function checkStudentCodeStatus(input: {
  eventCode: string;
  ticket: string;
  deviceId: string;
  studentCode: string;
  now?: number;
}): Promise<StudentCodeStatus> {
  const gate = await passTicketGate({ ...input, kind: "CHECK" });
  // Invalid and expired tickets both mean "scan again" for the student.
  if (!gate.ok) return gate.failure.error.code === "RATE_LIMITED" ? "RATE_LIMITED" : "TICKET_EXPIRED";

  const round = await db.round.findFirst({
    where: { id: gate.roundId, eventId: gate.eventId },
    select: {
      status: true,
      groupId: true,
      event: { select: { id: true, status: true, studentCodePattern: true, strictRoster: true } },
    },
  });
  if (!round || round.status !== "OPEN" || round.event.status === "ARCHIVED") return "ROUND_CLOSED";
  if (!matchesStudentCodePattern(input.studentCode, round.event.studentCodePattern)) return "INVALID_FORMAT";

  const student = await db.student.findUnique({
    where: { eventId_code: { eventId: round.event.id, code: input.studentCode } },
    select: { id: true, fullName: true, groupId: true },
  });
  const roster = evaluateRoster({ student, strictRoster: round.event.strictRoster, ratedGroupId: round.groupId });
  return roster.ok ? "OK" : roster.code;
}
