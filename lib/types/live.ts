// Client-safe response types (no server or Prisma imports).
import type { GroupStats } from "@/lib/stats";
import type { RatingFlag } from "@/lib/types/rating";

export type GroupRoundStatus = "NONE" | "OPEN" | "CLOSED";

export interface LiveGroup {
  id: string;
  name: string;
  order: number;
  roundStatus: GroupRoundStatus;
  validCount: number;
}

export interface LiveRating {
  studentCode: string;
  studentName: string;
  score: number;
  flags: RatingFlag[];
}

/** GET /api/events/[id]/live (SPEC §7). */
export interface LiveResponse {
  event: { id: string; title: string; code: string; rotatingQr: boolean; isArchived: boolean };
  groups: LiveGroup[];
  current: null | {
    roundId: string;
    groupId: string;
    groupName: string;
    openedAt: string;
    stats: GroupStats;
    /** D3: valid ratings, highest score first, then earliest first. */
    ratings: LiveRating[];
  };
}

/** GET /api/public/events/[code]/current — never includes roster or ratings (SPEC §9.5). */
export interface PublicCurrentResponse {
  event: { title: string };
  current: null | { roundId: string; groupName: string };
}
