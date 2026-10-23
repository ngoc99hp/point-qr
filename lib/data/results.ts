import "server-only";
import { db } from "@/lib/db";
import { decimalToNumber } from "@/lib/mappers";
import { rankGroups, type Ranked } from "@/lib/ranking";
import { computeStats, type GroupStats } from "@/lib/stats";
import type { RankingMetric, RatingFlag } from "@/lib/types/rating";

export interface ResultRating {
  id: string;
  studentCode: string;
  studentName: string;
  rosterName: string | null;
  score: number;
  flags: RatingFlag[];
  excluded: boolean;
  createdAt: Date;
  editCount: number;
}

export interface ResultGroup {
  id: string;
  name: string;
  order: number;
  stats: GroupStats;
  ratings: ResultRating[];
}

export interface EventResults {
  event: { id: string; title: string; code: string; rankingMetric: RankingMetric; trimRatio: number };
  groups: Ranked<ResultGroup>[];
}

/** Everything the results page and the CSV export need, in two queries' worth of data. */
export async function getEventResults(lecturerId: string, eventId: string): Promise<EventResults | null> {
  const event = await db.event.findFirst({
    where: { id: eventId, ownerId: lecturerId },
    select: {
      id: true,
      title: true,
      code: true,
      rankingMetric: true,
      trimRatio: true,
      groups: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          order: true,
          round: {
            select: {
              ratings: {
                orderBy: [{ score: "desc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  studentCode: true,
                  studentName: true,
                  score: true,
                  flags: true,
                  excluded: true,
                  createdAt: true,
                  editCount: true,
                  student: { select: { fullName: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!event) return null;

  const trimRatio = decimalToNumber(event.trimRatio);
  const groups: ResultGroup[] = event.groups.map((group) => {
    const ratings: ResultRating[] = (group.round?.ratings ?? []).map(({ student, score, ...rating }) => ({
      ...rating,
      score: decimalToNumber(score),
      rosterName: student?.fullName ?? null,
    }));
    return { id: group.id, name: group.name, order: group.order, stats: computeStats(ratings, trimRatio), ratings };
  });

  return {
    event: { id: event.id, title: event.title, code: event.code, rankingMetric: event.rankingMetric, trimRatio },
    groups: rankGroups(groups, event.rankingMetric),
  };
}
