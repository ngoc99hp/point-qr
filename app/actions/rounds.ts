"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireLecturer } from "@/lib/auth";
import { findOwnedGroup, findOwnedRound } from "@/lib/data/ownership";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { groupIdSchema, roundIdSchema } from "@/lib/validations/event";

const INVALID = "Dữ liệu không hợp lệ.";

/**
 * BR-01: opens the group's round and closes any other OPEN round of the event in
 * one transaction. BR-02: reopening keeps existing ratings and clears closedAt.
 * The partial unique index "Round_one_open_per_event" guards concurrent opens.
 */
export async function openRound(groupIdInput: string): Promise<ActionResult<{ roundId: string }>> {
  const { lecturerId } = await requireLecturer();
  const parsed = groupIdSchema.safeParse({ groupId: groupIdInput });
  if (!parsed.success) return fail("VALIDATION", INVALID);

  const group = await findOwnedGroup(lecturerId, parsed.data.groupId);
  if (!group) return fail("NOT_FOUND", "Không tìm thấy nhóm.");
  if (group.event.status === "ARCHIVED") {
    return fail("EVENT_ARCHIVED", "Buổi đánh giá đã lưu trữ, không thể mở phiên chấm.");
  }

  try {
    const round = await db.$transaction(async (tx) => {
      const now = new Date();
      await tx.round.updateMany({
        where: { eventId: group.eventId, status: "OPEN", NOT: { groupId: group.id } },
        data: { status: "CLOSED", closedAt: now },
      });
      return tx.round.upsert({
        where: { groupId: group.id },
        create: { eventId: group.eventId, groupId: group.id, status: "OPEN", openedAt: now },
        update: { status: "OPEN", closedAt: null },
        select: { id: true },
      });
    });
    return ok({ roundId: round.id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("CONFLICT", "Một phiên chấm khác vừa được mở. Vui lòng thử lại.");
    }
    throw error;
  }
}

export async function closeRound(roundIdInput: string): Promise<ActionResult> {
  const { lecturerId } = await requireLecturer();
  const parsed = roundIdSchema.safeParse({ roundId: roundIdInput });
  if (!parsed.success) return fail("VALIDATION", INVALID);

  const round = await findOwnedRound(lecturerId, parsed.data.roundId);
  if (!round) return fail("NOT_FOUND", "Không tìm thấy phiên chấm.");

  await db.round.updateMany({
    where: { id: round.id, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  return ok(undefined);
}
