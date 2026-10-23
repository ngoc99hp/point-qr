import "server-only";
import { db } from "@/lib/db";
import { decimalToNumber } from "@/lib/mappers";
import { computeStats, type RatingInput } from "@/lib/stats";
import { sortRatingsForProjector } from "@/lib/projector";
import type { LiveGroup, LiveResponse } from "@/lib/types/live";

/**
 * Snapshot for the projector screen: one query for the event, its groups and the
 * OPEN round's ratings, plus one groupBy for per-group valid counts (no N+1).
 * Returns null when the event does not exist or belongs to another lecturer.
 */
export async function getLiveSnapshot(
  lecturerId: string,
  eventId: string,
): Promise<LiveResponse | null> {
  const event = await db.event.findFirst({
    where: { id: eventId, ownerId: lecturerId },
    select: {
      id: true,
      title: true,
      code: true,
      status: true,
      rotatingQr: true,
      trimRatio: true,
      groups: {
        orderBy: { order: "asc" },
        select: { id: true, name: true, order: true, round: { select: { id: true, status: true } } },
      },
      rounds: {
        where: { status: "OPEN" },
        take: 1,
        select: {
          id: true,
          groupId: true,
          openedAt: true,
          group: { select: { name: true } },
          ratings: {
            select: {
              score: true,
              studentCode: true,
              studentName: true,
              createdAt: true,
              excluded: true,
              flags: true,
            },
          },
        },
      },
    },
  });
  if (!event) return null;

  const counts = await db.rating.groupBy({
    by: ["roundId"],
    where: { excluded: false, round: { eventId: event.id } },
    _count: { _all: true },
  });
  const countByRound = new Map(counts.map((row) => [row.roundId, row._count._all]));

  const groups: LiveGroup[] = event.groups.map((group) => ({
    id: group.id,
    name: group.name,
    order: group.order,
    roundStatus: group.round?.status ?? "NONE",
    validCount: group.round ? (countByRound.get(group.round.id) ?? 0) : 0,
  }));

  const open = event.rounds[0];
  const ratings: RatingInput[] = (open?.ratings ?? []).map((rating) => ({
    ...rating,
    score: decimalToNumber(rating.score),
  }));

  return {
    event: {
      id: event.id,
      title: event.title,
      code: event.code,
      rotatingQr: event.rotatingQr,
      isArchived: event.status === "ARCHIVED",
    },
    groups,
    current: open
      ? {
          roundId: open.id,
          groupId: open.groupId,
          groupName: open.group.name,
          openedAt: open.openedAt.toISOString(),
          stats: computeStats(ratings, decimalToNumber(event.trimRatio)),
          ratings: sortRatingsForProjector(ratings),
        }
      : null,
  };
}
