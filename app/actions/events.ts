"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, readFormString, type ActionResult } from "@/lib/action-result";
import { requireLecturer } from "@/lib/auth";
import { findOwnedEvent } from "@/lib/data/ownership";
import { db } from "@/lib/db";
import { generateEventCode } from "@/lib/event-code";
import { isUniqueViolation } from "@/lib/prisma-errors";
import {
  createEventSchema,
  eventIdSchema,
  eventSettingsSchema,
} from "@/lib/validations/event";

const MAX_CODE_ATTEMPTS = 5;
const NOT_FOUND = "Không tìm thấy buổi đánh giá.";

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
        // P1 uses a static QR (SPEC §14 P1); rotating QR arrives in P3.
        data: { ownerId: lecturerId, title: parsed.data.title, code: generateEventCode(), rotatingQr: false },
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
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const { eventId, ...settings } = parsed.data;
  const event = await findOwnedEvent(lecturerId, eventId);
  if (!event) return fail("NOT_FOUND", NOT_FOUND);

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
