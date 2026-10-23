"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireLecturer } from "@/lib/auth";
import { findOwnedEvent, findOwnedGroup } from "@/lib/data/ownership";
import {
  RosterReplaceBlockedError,
  writeRoster,
  type ImportMode,
  type ImportSummary,
} from "@/lib/data/roster-import";
import { db } from "@/lib/db";
import { nextGroupName } from "@/lib/groups";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { parseRoster } from "@/lib/roster";
import {
  eventIdSchema,
  groupIdSchema,
  moveGroupSchema,
  renameGroupSchema,
} from "@/lib/validations/event";

// Manual group management (P1) and roster import (P2, SPEC §6.4).

const INVALID = "Dữ liệu không hợp lệ.";
const GROUP_NOT_FOUND = "Không tìm thấy nhóm.";
const DUPLICATE_NAME = "Tên nhóm đã tồn tại trong buổi đánh giá này.";
const MAX_ADD_ATTEMPTS = 3;
const MAX_ROSTER_TEXT = 200_000;
const ARCHIVED = "Buổi đánh giá đã lưu trữ. Khôi phục để chỉnh sửa nhóm.";

export async function addGroup(eventIdInput: string): Promise<ActionResult> {
  const { lecturerId } = await requireLecturer();
  const parsed = eventIdSchema.safeParse({ eventId: eventIdInput });
  if (!parsed.success) return fail("VALIDATION", INVALID);

  const event = await findOwnedEvent(lecturerId, parsed.data.eventId);
  if (!event) return fail("NOT_FOUND", "Không tìm thấy buổi đánh giá.");
  if (event.status === "ARCHIVED") return fail("EVENT_ARCHIVED", ARCHIVED);

  // Retry when a concurrent add took the same order/name.
  for (let attempt = 0; attempt < MAX_ADD_ATTEMPTS; attempt += 1) {
    const groups = await db.group.findMany({
      where: { eventId: event.id },
      select: { name: true, order: true },
    });
    const order = Math.max(0, ...groups.map((group) => group.order)) + 1;
    try {
      await db.group.create({
        data: { eventId: event.id, name: nextGroupName(groups.map((g) => g.name)), order },
        select: { id: true },
      });
      refresh();
      return ok(undefined);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return fail("CONFLICT", "Không thêm được nhóm. Vui lòng thử lại.");
}

export async function renameGroup(groupIdInput: string, nameInput: string): Promise<ActionResult> {
  const { lecturerId } = await requireLecturer();
  const parsed = renameGroupSchema.safeParse({ groupId: groupIdInput, name: nameInput });
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.issues[0]?.message ?? INVALID, "name");
  }

  const group = await findOwnedGroup(lecturerId, parsed.data.groupId);
  if (!group) return fail("NOT_FOUND", GROUP_NOT_FOUND);
  if (group.event.status === "ARCHIVED") return fail("EVENT_ARCHIVED", ARCHIVED);

  try {
    await db.group.update({
      where: { id: group.id },
      data: { name: parsed.data.name },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("DUPLICATE", DUPLICATE_NAME, "name");
    throw error;
  }
  refresh();
  return ok(undefined);
}

export async function moveGroup(
  groupIdInput: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const { lecturerId } = await requireLecturer();
  const parsed = moveGroupSchema.safeParse({ groupId: groupIdInput, direction });
  if (!parsed.success) return fail("VALIDATION", INVALID);

  const group = await findOwnedGroup(lecturerId, parsed.data.groupId);
  if (!group) return fail("NOT_FOUND", GROUP_NOT_FOUND);
  if (group.event.status === "ARCHIVED") return fail("EVENT_ARCHIVED", ARCHIVED);

  const isUp = parsed.data.direction === "up";
  const neighbor = await db.group.findFirst({
    where: { eventId: group.eventId, order: isUp ? { lt: group.order } : { gt: group.order } },
    orderBy: { order: isUp ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbor) return ok(undefined); // already first/last

  // Swap through a temporary order to satisfy @@unique([eventId, order]).
  await db.$transaction([
    db.group.update({ where: { id: group.id }, data: { order: -1 }, select: { id: true } }),
    db.group.update({ where: { id: neighbor.id }, data: { order: group.order }, select: { id: true } }),
    db.group.update({ where: { id: group.id }, data: { order: neighbor.order }, select: { id: true } }),
  ]);
  refresh();
  return ok(undefined);
}

/**
 * Deletes a group (its round and ratings cascade). A group with ratings is only
 * deleted when the caller explicitly acknowledges losing them (SPEC §14 P4).
 * Its students stay in the roster without a group.
 */
export async function deleteGroup(groupIdInput: string, acknowledgeRatings = false): Promise<ActionResult> {
  const { lecturerId } = await requireLecturer();
  const parsed = groupIdSchema.safeParse({ groupId: groupIdInput });
  if (!parsed.success) return fail("VALIDATION", INVALID);

  const group = await findOwnedGroup(lecturerId, parsed.data.groupId);
  if (!group) return fail("NOT_FOUND", GROUP_NOT_FOUND);
  if (group.event.status === "ARCHIVED") return fail("EVENT_ARCHIVED", ARCHIVED);
  if (group.round?.status === "OPEN") {
    return fail("ROUND_OPEN", "Hãy đóng phiên chấm của nhóm này trước khi xóa.");
  }
  if ((group.round?._count.ratings ?? 0) > 0 && acknowledgeRatings !== true) {
    return fail("HAS_RATINGS", "Nhóm đã có phiếu chấm. Hãy xác nhận xóa cả phiếu chấm.");
  }

  await db.group.delete({ where: { id: group.id }, select: { id: true } });
  refresh();
  return ok(undefined);
}

/** Removes every student of the event (groups and ratings stay; ratings lose their roster link). */
export async function clearRoster(
  eventIdInput: string,
  acknowledgeRatings = false,
): Promise<ActionResult<{ deleted: number }>> {
  const { lecturerId } = await requireLecturer();
  const parsed = eventIdSchema.safeParse({ eventId: eventIdInput });
  if (!parsed.success) return fail("VALIDATION", INVALID);

  const event = await findOwnedEvent(lecturerId, parsed.data.eventId);
  if (!event) return fail("NOT_FOUND", "Không tìm thấy buổi đánh giá.");
  if (event.status === "ARCHIVED") return fail("EVENT_ARCHIVED", ARCHIVED);
  const openRounds = await db.round.count({ where: { eventId: event.id, status: "OPEN" }, take: 1 });
  if (openRounds > 0) return fail("ROUND_OPEN", "Hãy đóng phiên chấm đang mở trước khi xóa danh sách lớp.");
  // Existing ratings lose their roster link (studentId → null); require an explicit OK.
  const ratings = await db.rating.count({ where: { round: { eventId: event.id } }, take: 1 });
  if (ratings > 0 && acknowledgeRatings !== true) {
    return fail("HAS_RATINGS", "Buổi đánh giá đã có phiếu chấm. Hãy xác nhận xóa danh sách lớp.");
  }

  const { count } = await db.student.deleteMany({ where: { eventId: event.id } });
  refresh();
  return ok({ deleted: count });
}

const importRosterSchema = z.object({
  eventId: z.string().min(1).max(64),
  text: z.string().max(MAX_ROSTER_TEXT, "Dữ liệu quá lớn (tối đa khoảng 2.000 dòng)."),
  mode: z.enum(["replace", "append"]),
});

/** Imports a pasted TSV/CSV roster after re-parsing and re-validating it on the server. */
export async function importRoster(
  eventIdInput: string,
  text: string,
  mode: ImportMode,
): Promise<ActionResult<ImportSummary>> {
  const { lecturerId } = await requireLecturer();
  const parsed = importRosterSchema.safeParse({ eventId: eventIdInput, text, mode });
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? INVALID);

  const event = await db.event.findFirst({
    where: { id: parsed.data.eventId, ownerId: lecturerId },
    select: { id: true, status: true, studentCodePattern: true },
  });
  if (!event) return fail("NOT_FOUND", "Không tìm thấy buổi đánh giá.");
  if (event.status === "ARCHIVED") return fail("EVENT_ARCHIVED", ARCHIVED);

  const roster = parseRoster(parsed.data.text, event.studentCodePattern);
  if (roster.errors.length > 0) {
    return fail("VALIDATION", `Có ${roster.errors.length} dòng lỗi. Sửa lại rồi nhập lại.`);
  }
  if (roster.rows.length === 0) return fail("VALIDATION", "Không có dòng dữ liệu nào.");

  // Replace preconditions are checked inside writeRoster under row locks (no race).
  try {
    const summary = await writeRoster(event.id, roster.rows, parsed.data.mode);
    refresh();
    return ok(summary);
  } catch (error) {
    if (error instanceof RosterReplaceBlockedError) {
      return fail(
        "HAS_RATINGS",
        "Buổi đánh giá đã có phiếu hoặc đang mở phiên chấm, không thể thay thế toàn bộ. Hãy dùng chế độ bổ sung.",
      );
    }
    throw error;
  }
}
