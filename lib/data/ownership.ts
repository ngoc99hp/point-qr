import "server-only";
import { db } from "@/lib/db";

// Every lecturer-side lookup filters by ownerId (SPEC §9.5). A resource owned by
// someone else is indistinguishable from a missing one (callers respond 404).

export async function findOwnedEvent(lecturerId: string, eventId: string) {
  return db.event.findFirst({
    where: { id: eventId, ownerId: lecturerId },
    select: { id: true, code: true, status: true },
  });
}

export async function findOwnedGroup(lecturerId: string, groupId: string) {
  return db.group.findFirst({
    where: { id: groupId, event: { ownerId: lecturerId } },
    select: {
      id: true,
      name: true,
      order: true,
      eventId: true,
      event: { select: { status: true } },
      round: { select: { id: true, status: true, _count: { select: { ratings: true } } } },
    },
  });
}

export async function findOwnedRound(lecturerId: string, roundId: string) {
  return db.round.findFirst({
    where: { id: roundId, event: { ownerId: lecturerId } },
    select: { id: true, eventId: true, status: true },
  });
}
