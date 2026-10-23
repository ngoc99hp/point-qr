"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, readFormString, type ActionResult } from "@/lib/action-result";
import { requireLecturer } from "@/lib/auth";
import { findOwnedEvent } from "@/lib/data/ownership";
import { db } from "@/lib/db";
import { generateEventCode } from "@/lib/event-code";
import { toScoreConfig, type DecimalScoreConfig } from "@/lib/mappers";
import { isUniqueViolation } from "@/lib/prisma-errors";
import {
  createEventSchema,
  eventIdSchema,
  eventSettingsSchema,
  type EventSettingsInput,
} from "@/lib/validations/event";

const MAX_CODE_ATTEMPTS = 5;
const NOT_FOUND = "Không tìm thấy buổi đánh giá.";
const ARCHIVED = "Buổi đánh giá đã lưu trữ. Khôi phục để chỉnh sửa.";

type EventFormState = ActionResult | null;

function firstIssue(error: { issues: { message: string; path: PropertyKey[] }[] }) {
  const issue = error.issues[0];
  return fail("VALIDATION", issue?.message ?? "Dữ liệu không hợp lệ.", issue?.path.join("."));
}

export async function createEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const { lecturerId } = await requireLecturer();
  const parsed = createEventSchema.safeParse({ title: readFormString(formData, "title") });
  if (!parsed.success) return firstIssue(parsed.error);

  let eventId: string | null = null;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !eventId; attempt += 1) {
    try {
      const event = await db.event.create({
        // rotatingQr uses the schema default (true since P3, SPEC §14 P3).
        data: { ownerId: lecturerId, title: parsed.data.title, code: generateEventCode() },
        select: { id: true },
      });
      eventId = event.id;
    } catch (error) {
      if (!isUniqueViolation(error, "code")) throw error;
    }
  }
  if (!eventId) return fail("CODE_EXHAUSTED", "Không tạo được mã buổi đánh giá. Vui lòng thử lại.");

  redirect(`/events/${eventId}`);
}

type ScoringRules = Pick<EventSettingsInput, "minScore" | "maxScore" | "scoreStep" | "studentCodePattern">;

/**
 * Existing ratings were validated against the current rules (BR-04/05), so the
 * scoring rules are frozen once any rating exists; the title stays editable.
 */
function changesScoringRules(
  event: DecimalScoreConfig & { studentCodePattern: string },
  next: ScoringRules,
): boolean {
  const current = toScoreConfig(event);
  return (
    next.minScore !== current.minScore ||
    next.maxScore !== current.maxScore ||
    next.scoreStep !== current.scoreStep ||
    next.studentCodePattern !== event.studentCodePattern
  );
}

async function hasRatings(eventId: string): Promise<boolean> {
  return (await db.rating.count({ where: { round: { eventId } }, take: 1 })) > 0;
}

export async function updateEventSettings(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const { lecturerId } = await requireLecturer();
  const parsed = eventSettingsSchema.safeParse({
    eventId: readFormString(formData, "eventId"),
    title: readFormString(formData, "title"),
    minScore: readFormString(formData, "minScore"),
    maxScore: readFormString(formData, "maxScore"),
    scoreStep: readFormString(formData, "scoreStep"),
    studentCodePattern: readFormString(formData, "studentCodePattern"),
    rankingMetric: readFormString(formData, "rankingMetric"),
    trimRatio: readFormString(formData, "trimRatio"),
    strictRoster: formData.get("strictRoster") === "on",
    rotatingQr: formData.get("rotatingQr") === "on",
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const { eventId, ...settings } = parsed.data;
  const event = await db.event.findFirst({
    where: { id: eventId, ownerId: lecturerId },
    select: {
      id: true,
      status: true,
      minScore: true,
      maxScore: true,
      scoreStep: true,
      studentCodePattern: true,
    },
  });
  if (!event) return fail("NOT_FOUND", NOT_FOUND);
  if (event.status === "ARCHIVED") return fail("EVENT_ARCHIVED", ARCHIVED);

  if (changesScoringRules(event, settings) && (await hasRatings(event.id))) {
    return fail(
      "HAS_RATINGS",
      "Đã có phiếu chấm nên không thể đổi thang điểm hoặc định dạng MSV. Chỉ đổi được tên.",
    );
  }

  await db.event.update({ where: { id: event.id }, data: settings, select: { id: true } });
  refresh();
  return ok(undefined);
}

export async function setEventArchived(
  eventIdInput: string,
  archived: boolean,
): Promise<ActionResult> {
  const { lecturerId } = await requireLecturer();
  const parsed = eventIdSchema.safeParse({ eventId: eventIdInput });
  if (!parsed.success) return fail("VALIDATION", "Dữ liệu không hợp lệ.");

  const event = await findOwnedEvent(lecturerId, parsed.data.eventId);
  if (!event) return fail("NOT_FOUND", NOT_FOUND);

  if (archived) {
    const openRounds = await db.round.count({ where: { eventId: event.id, status: "OPEN" } });
    if (openRounds > 0) {
      return fail("ROUND_OPEN", "Hãy đóng phiên chấm đang mở trước khi lưu trữ.");
    }
  }

  await db.event.update({
    where: { id: event.id },
    data: { status: archived ? "ARCHIVED" : "ACTIVE" },
    select: { id: true },
  });
  refresh();
  return ok(undefined);
}

const deleteEventSchema = z.object({ eventId: z.string().min(1).max(64), confirmCode: z.string().trim().min(1).max(16) });

/**
 * Permanently deletes an event with all groups, students, rounds and ratings
 * (SPEC §14 P4). The lecturer must type the event code; open rounds must be closed.
 */
export async function deleteEvent(eventIdInput: string, confirmCode: string): Promise<ActionResult> {
  const { lecturerId } = await requireLecturer();
  const parsed = deleteEventSchema.safeParse({ eventId: eventIdInput, confirmCode });
  if (!parsed.success) return fail("VALIDATION", "Dữ liệu không hợp lệ.");

  const event = await findOwnedEvent(lecturerId, parsed.data.eventId);
  if (!event) return fail("NOT_FOUND", NOT_FOUND);
  if (parsed.data.confirmCode.toUpperCase() !== event.code) {
    return fail("VALIDATION", "Mã xác nhận không khớp.", "confirmCode");
  }
  const openRounds = await db.round.count({ where: { eventId: event.id, status: "OPEN" }, take: 1 });
  if (openRounds > 0) return fail("ROUND_OPEN", "Hãy đóng phiên chấm đang mở trước khi xóa.");

  await db.event.delete({ where: { id: event.id }, select: { id: true } });
  // The client shows a toast, navigates to /events and refreshes (DeleteEventButton).
  revalidatePath("/events");
  return ok(undefined);
}
