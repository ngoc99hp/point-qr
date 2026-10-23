"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { parseEventCode } from "@/lib/event-code";
import { logger } from "@/lib/logger";
import { toScoreConfig } from "@/lib/mappers";
import { matchesStudentCodePattern, normalizeCode } from "@/lib/normalize";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { isValidScore } from "@/lib/score";
import { submitRatingSchema, type SubmitRatingInput } from "@/lib/validations/rating";

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

const USER_AGENT_MAX = 300;

class SubmitRejection extends Error {
  constructor(readonly result: Extract<SubmitRatingResult, { success: false }>) {
    super(result.error.code);
  }
}

async function requestFingerprint(): Promise<{ ipHash: string; userAgent: string | null }> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || requestHeaders.get("x-real-ip") || "unknown";
  return {
    // Raw IPs are never stored (SPEC §9.5).
    ipHash: createHash("sha256").update(`${ip}${env.TICKET_SECRET}`).digest("hex"),
    userAgent: requestHeaders.get("user-agent")?.slice(0, USER_AGENT_MAX) ?? null,
  };
}

/**
 * PUBLIC. Order (SPEC §7, P1 subset): validate input → load the round inside a
 * transaction → BR-03 open check → BR-04 code pattern → BR-05 score → BR-06 upsert.
 * Roster rules (BR-07..10), ticket and rate limit arrive in P2/P3.
 */
export async function submitRating(input: SubmitRatingInput): Promise<SubmitRatingResult> {
  const parsed = submitRatingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail("VALIDATION", issue?.message ?? "Dữ liệu không hợp lệ.", issue?.path.join("."));
  }
  const data = parsed.data;
  const eventCode = parseEventCode(data.eventCode);
  if (!eventCode) return fail("TICKET_INVALID", "Mã buổi đánh giá không hợp lệ. Vui lòng quét lại mã QR.");

  const saveInput: SaveRatingInput = {
    eventCode,
    roundId: data.roundId,
    studentCode: normalizeCode(data.studentCode),
    studentName: data.studentName,
    score: data.score,
    deviceId: data.deviceId,
    ...(await requestFingerprint()),
  };

  try {
    return await saveRatingOrRejection(saveInput);
  } catch (error) {
    if (!isUniqueViolation(error)) {
      logger.error("submitRating failed", { roundId: data.roundId }, error);
      throw error;
    }
    // A concurrent first submission for the same student won the insert; retry as update.
    return saveRatingOrRejection(saveInput);
  }
}

async function saveRatingOrRejection(input: SaveRatingInput): Promise<SubmitRatingResult> {
  try {
    return await saveRating(input);
  } catch (error) {
    if (error instanceof SubmitRejection) return error.result;
    throw error;
  }
}

interface SaveRatingInput {
  eventCode: string;
  roundId: string;
  studentCode: string;
  studentName: string;
  score: number;
  deviceId: string;
  ipHash: string;
  userAgent: string | null;
}

async function saveRating(input: SaveRatingInput): Promise<SubmitRatingResult> {
  return db.$transaction(async (tx) => {
    const round = await tx.round.findFirst({
      where: { id: input.roundId, event: { code: input.eventCode } },
      select: {
        id: true,
        status: true,
        group: { select: { name: true } },
        event: {
          select: {
            id: true,
            status: true,
            minScore: true,
            maxScore: true,
            scoreStep: true,
            studentCodePattern: true,
          },
        },
      },
    });
    if (!round) {
      throw new SubmitRejection(
        fail("TICKET_INVALID", "Phiên chấm không hợp lệ. Vui lòng quét lại mã QR trên màn chiếu."),
      );
    }

    const context = { eventId: round.event.id, roundId: round.id };
    if (round.status !== "OPEN" || round.event.status === "ARCHIVED") {
      logger.warn("submitRating rejected", { ...context, code: "ROUND_CLOSED" });
      throw new SubmitRejection(fail("ROUND_CLOSED", "Phiên chấm đã đóng."));
    }
    if (!matchesStudentCodePattern(input.studentCode, round.event.studentCodePattern)) {
      throw new SubmitRejection(
        fail("VALIDATION", "MSV không đúng định dạng. Vui lòng kiểm tra lại.", "studentCode"),
      );
    }
    if (!isValidScore(input.score, toScoreConfig(round.event))) {
      throw new SubmitRejection(fail("VALIDATION", "Điểm không hợp lệ.", "score"));
    }

    const writable = {
      studentName: input.studentName,
      score: input.score,
      deviceId: input.deviceId,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    };
    const rating = await tx.rating.upsert({
      where: { roundId_studentCode: { roundId: round.id, studentCode: input.studentCode } },
      create: { roundId: round.id, studentCode: input.studentCode, ...writable },
      update: { ...writable, editCount: { increment: 1 } },
      select: { editCount: true },
    });

    return ok({
      status: rating.editCount === 0 ? "created" : "updated",
      groupName: round.group.name,
    });
  });
}
