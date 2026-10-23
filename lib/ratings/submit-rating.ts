import "server-only";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { toScoreConfig } from "@/lib/mappers";
import { matchesStudentCodePattern } from "@/lib/normalize";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { evaluateFlags, evaluateRoster } from "@/lib/rating-rules";
import { isValidScore } from "@/lib/score";
import { passTicketGate } from "@/lib/ratings/ticket-gate";

export type SubmitErrorCode =
  | "VALIDATION"
  | "TICKET_INVALID"
  | "TICKET_EXPIRED"
  | "ROUND_CLOSED"
  | "NOT_IN_ROSTER"
  | "SELF_RATING"
  | "RATE_LIMITED";

export type SubmitRatingResult = ActionResult<
  { status: "created" | "updated"; groupName: string },
  SubmitErrorCode
>;

/** Already parsed and normalized input (studentCode upper-cased, name collapsed). */
export interface SaveRatingInput {
  eventCode: string;
  roundId: string;
  studentCode: string;
  studentName: string;
  score: number;
  deviceId: string;
  ipHash: string;
  userAgent: string | null;
}

export const NOT_IN_ROSTER_MESSAGE = "MSV không có trong danh sách lớp. Kiểm tra lại hoặc báo giảng viên.";
export const SELF_RATING_MESSAGE = "Bạn không thể chấm nhóm của mình.";
export const INVALID_CODE_MESSAGE = "MSV không đúng định dạng. Vui lòng kiểm tra lại.";

class SubmitRejection extends Error {
  constructor(readonly result: Extract<SubmitRatingResult, { success: false }>) {
    super(result.error.code);
  }
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const roundForRatingSelect = {
  id: true,
  status: true,
  groupId: true,
  group: { select: { name: true } },
  event: {
    select: {
      id: true,
      status: true,
      minScore: true,
      maxScore: true,
      scoreStep: true,
      studentCodePattern: true,
      strictRoster: true,
    },
  },
} as const;

/**
 * Loads the round under a row lock (FOR SHARE) so a concurrent closeRound/openRound
 * — which UPDATE that row — waits for this transaction, and vice versa (BR-03).
 * Then applies BR-03, BR-04 and BR-05.
 */
async function loadAcceptingRound(tx: Tx, input: SaveRatingInput) {
  await tx.$queryRaw`SELECT 1 FROM "Round" WHERE id = ${input.roundId} FOR SHARE`;
  const round = await tx.round.findFirst({
    where: { id: input.roundId, event: { code: input.eventCode } },
    select: roundForRatingSelect,
  });
  if (!round) {
    throw new SubmitRejection(
      fail("TICKET_INVALID", "Phiên chấm không hợp lệ. Vui lòng quét lại mã QR trên màn chiếu."),
    );
  }
  if (round.status !== "OPEN" || round.event.status === "ARCHIVED") {
    logger.warn("submitRating rejected", { eventId: round.event.id, roundId: round.id, code: "ROUND_CLOSED" });
    throw new SubmitRejection(fail("ROUND_CLOSED", "Phiên chấm đã đóng."));
  }
  if (!matchesStudentCodePattern(input.studentCode, round.event.studentCodePattern)) {
    throw new SubmitRejection(fail("VALIDATION", INVALID_CODE_MESSAGE, "studentCode"));
  }
  if (!isValidScore(input.score, toScoreConfig(round.event))) {
    throw new SubmitRejection(fail("VALIDATION", "Điểm không hợp lệ.", "score"));
  }
  return round;
}

type AcceptingRound = Awaited<ReturnType<typeof loadAcceptingRound>>;

/** BR-08 → BR-07 → BR-09/BR-10 flags; throws on rejection. */
async function decideFlags(tx: Tx, round: AcceptingRound, input: SaveRatingInput) {
  const student = await tx.student.findUnique({
    where: { eventId_code: { eventId: round.event.id, code: input.studentCode } },
    select: { id: true, fullName: true, groupId: true },
  });
  const roster = evaluateRoster({ student, strictRoster: round.event.strictRoster, ratedGroupId: round.groupId });
  if (!roster.ok) {
    logger.warn("submitRating rejected", { eventId: round.event.id, roundId: round.id, code: roster.code });
    const message = roster.code === "NOT_IN_ROSTER" ? NOT_IN_ROSTER_MESSAGE : SELF_RATING_MESSAGE;
    throw new SubmitRejection(fail(roster.code, message, "studentCode"));
  }

  const [otherOnDevice, previous] = await Promise.all([
    tx.rating.findFirst({
      where: { roundId: round.id, deviceId: input.deviceId, studentCode: { not: input.studentCode } },
      select: { id: true },
    }),
    tx.rating.findUnique({
      where: { roundId_studentCode: { roundId: round.id, studentCode: input.studentCode } },
      select: { excluded: true, excludedBy: true },
    }),
  ]);
  const decision = evaluateFlags({
    unknownStudent: roster.unknownStudent,
    enteredName: input.studentName,
    rosterName: student?.fullName ?? null,
    deviceUsedByOtherStudent: otherOnDevice !== null,
    previous,
  });
  return { studentId: student?.id ?? null, ...decision };
}

async function saveRating(input: SaveRatingInput): Promise<SubmitRatingResult> {
  return db.$transaction(async (tx) => {
    const round = await loadAcceptingRound(tx, input);
    const decision = await decideFlags(tx, round, input);
    const writable = {
      studentName: input.studentName,
      score: input.score,
      deviceId: input.deviceId,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
      ...decision,
    };
    const rating = await tx.rating.upsert({
      where: { roundId_studentCode: { roundId: round.id, studentCode: input.studentCode } },
      create: { roundId: round.id, studentCode: input.studentCode, ...writable },
      update: { ...writable, editCount: { increment: 1 } },
      select: { editCount: true },
    });
    return ok({ status: rating.editCount === 0 ? "created" : "updated", groupName: round.group.name });
  });
}

async function saveRatingOrRejection(input: SaveRatingInput): Promise<SubmitRatingResult> {
  try {
    return await saveRating(input);
  } catch (error) {
    if (error instanceof SubmitRejection) return error.result;
    throw error;
  }
}

/**
 * Core of the public submitRating action (SPEC §7, §14 P2): BR-03 → BR-04 → BR-05 →
 * BR-08 → BR-07 → BR-09 → BR-10 → upsert (BR-06). Retries once when a concurrent
 * first submission for the same student won the insert.
 */
export async function processRating(input: SaveRatingInput): Promise<SubmitRatingResult> {
  try {
    return await saveRatingOrRejection(input);
  } catch (error) {
    if (!isUniqueViolation(error)) {
      logger.error("submitRating failed", { roundId: input.roundId }, error);
      throw error;
    }
    return saveRatingOrRejection(input);
  }
}

export interface TicketRatingInput extends Omit<SaveRatingInput, "roundId"> {
  ticket: string;
  /** Injected clock (ms) for tests; defaults to Date.now(). */
  now?: number;
}

/**
 * Public entry point (SPEC §7, P3): verify the ticket (§9.2) and the device rate
 * limit (§9.3), then process the rating for the ticket's round.
 */
export async function submitWithTicket(input: TicketRatingInput): Promise<SubmitRatingResult> {
  const { ticket, now, ...rating } = input;
  const gate = await passTicketGate({ ticket, deviceId: rating.deviceId, kind: "SUBMIT", now });
  if (!gate.ok) return gate.failure;
  return processRating({ ...rating, roundId: gate.roundId });
}
