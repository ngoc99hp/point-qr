import "server-only";
import { db } from "@/lib/db";
import { matchesStudentCodePattern } from "@/lib/normalize";
import { evaluateRoster } from "@/lib/rating-rules";

export type StudentCodeStatus = "OK" | "INVALID_FORMAT" | "NOT_IN_ROSTER" | "SELF_RATING" | "ROUND_CLOSED";

/**
 * D4: early feedback while the student types. Returns only a status — never the
 * roster name or group (SPEC §9.5). submitRating re-checks everything.
 */
export async function checkStudentCodeStatus(input: {
  eventCode: string;
  roundId: string;
  studentCode: string;
}): Promise<StudentCodeStatus> {
  const round = await db.round.findFirst({
    where: { id: input.roundId, event: { code: input.eventCode } },
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
