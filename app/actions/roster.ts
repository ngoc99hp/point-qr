"use server";

import { refresh } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireLecturer } from "@/lib/auth";
import { findOwnedEvent, findOwnedGroup } from "@/lib/data/ownership";
import { db } from "@/lib/db";
import { nextGroupName } from "@/lib/groups";
import { isUniqueViolation } from "@/lib/prisma-errors";
import {
  eventIdSchema,
  groupIdSchema,
  moveGroupSchema,
  renameGroupSchema,
} from "@/lib/validations/event";

// P1: manual group management only. Roster import (importRoster) arrives in P2.

const INVALID = "Dữ liệu không hợp lệ.";
const GROUP_NOT_FOUND = "Không tìm thấy nhóm.";
const DUPLICATE_NAME = "Tên nhóm đã tồn tại trong buổi đánh giá này.";
const MAX_ADD_ATTEMPTS = 3;
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

export async function deleteGroup(groupIdInput: string): Promise<ActionResult> {
  const { lecturerId } = await requireLecturer();
  const parsed = groupIdSchema.safeParse({ groupId: groupIdInput });
  if (!parsed.success) return fail("VALIDATION", INVALID);

  const group = await findOwnedGroup(lecturerId, parsed.data.groupId);
  if (!group) return fail("NOT_FOUND", GROUP_NOT_FOUND);
  if (group.event.status === "ARCHIVED") return fail("EVENT_ARCHIVED", ARCHIVED);
  if (group.round?.status === "OPEN") {
    return fail("ROUND_OPEN", "Hãy đóng phiên chấm của nhóm này trước khi xóa.");
  }
  if ((group.round?._count.ratings ?? 0) > 0) {
    return fail("HAS_RATINGS", "Không thể xóa nhóm đã có phiếu chấm.");
  }

  await db.group.delete({ where: { id: group.id }, select: { id: true } });
  refresh();
  return ok(undefined);
}
