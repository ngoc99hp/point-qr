"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireLecturer } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { parseEventCode } from "@/lib/event-code";
import { normalizeCode } from "@/lib/normalize";
import { MANUAL_INCLUDE } from "@/lib/rating-rules";
import { checkStudentCodeStatus, type StudentCodeStatus } from "@/lib/ratings/check-student-code";
import { submitWithTicket, type SubmitRatingResult } from "@/lib/ratings/submit-rating";
import { submitRatingSchema, ticketSchema, type SubmitRatingInput } from "@/lib/validations/rating";

export type { SubmitErrorCode, SubmitRatingResult } from "@/lib/ratings/submit-rating";
export type { StudentCodeStatus } from "@/lib/ratings/check-student-code";

const USER_AGENT_MAX = 300;
const INVALID_EVENT = "Mã buổi đánh giá không hợp lệ. Vui lòng quét lại mã QR.";

async function requestFingerprint(): Promise<{ ipHash: string; userAgent: string | null }> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || requestHeaders.get("x-real-ip") || "unknown";
  return {
    // Raw IPs are never stored (SPEC §9.5).
    // Domain-separated keyed hash: never reusable as a ticket/QR signature.
    ipHash: createHmac("sha256", env.TICKET_SECRET).update(`ip:${ip}`).digest("hex"),
    userAgent: requestHeaders.get("user-agent")?.slice(0, USER_AGENT_MAX) ?? null,
  };
}

/** PUBLIC. Validates input, then delegates to submitWithTicket (ticket, rate limit, rules). */
export async function submitRating(input: SubmitRatingInput): Promise<SubmitRatingResult> {
  const parsed = submitRatingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail("VALIDATION", issue?.message ?? "Dữ liệu không hợp lệ.", issue?.path.join("."));
  }
  const eventCode = parseEventCode(parsed.data.eventCode);
  if (!eventCode) return fail("TICKET_INVALID", INVALID_EVENT);

  return submitWithTicket({
    ...parsed.data,
    eventCode,
    studentCode: normalizeCode(parsed.data.studentCode),
    ...(await requestFingerprint()),
  });
}

const checkStudentCodeSchema = z.object({
  eventCode: z.string().trim().min(1).max(16),
  ticket: ticketSchema,
  deviceId: z.uuid(),
  studentCode: z.string().trim().min(1).max(32),
});

/** PUBLIC (D4). Early roster feedback for the student form; returns a status only. */
export async function checkStudentCode(
  input: z.input<typeof checkStudentCodeSchema>,
): Promise<ActionResult<{ status: StudentCodeStatus }, "VALIDATION">> {
  const parsed = checkStudentCodeSchema.safeParse(input);
  const eventCode = parsed.success ? parseEventCode(parsed.data.eventCode) : null;
  if (!parsed.success || !eventCode) return fail("VALIDATION", "Dữ liệu không hợp lệ.");

  const status = await checkStudentCodeStatus({
    eventCode,
    ticket: parsed.data.ticket,
    deviceId: parsed.data.deviceId,
    studentCode: normalizeCode(parsed.data.studentCode),
  });
  return ok({ status });
}

const setExcludedSchema = z.object({ ratingId: z.string().min(1).max(64), excluded: z.boolean() });

/** AUTH (BR-11). Lecturer excludes or restores any rating of their own events. */
export async function setRatingExcluded(ratingId: string, excluded: boolean): Promise<ActionResult> {
  const { lecturerId } = await requireLecturer();
  const parsed = setExcludedSchema.safeParse({ ratingId, excluded });
  if (!parsed.success) return fail("VALIDATION", "Dữ liệu không hợp lệ.");

  // Restoring records MANUAL_INCLUDE so a later resubmission cannot auto-exclude it again.
  const result = await db.rating.updateMany({
    where: {
      id: parsed.data.ratingId,
      round: { event: { ownerId: lecturerId, status: { not: "ARCHIVED" } } },
    },
    data: { excluded: parsed.data.excluded, excludedBy: parsed.data.excluded ? lecturerId : MANUAL_INCLUDE },
  });
  if (result.count === 0) {
    return fail("NOT_FOUND", "Không tìm thấy phiếu chấm, hoặc buổi đánh giá đã lưu trữ.");
  }
  refresh();
  return ok(undefined);
}
