import "server-only";
import { db } from "@/lib/db";
import { parseEventCode } from "@/lib/event-code";
import { toScoreConfig } from "@/lib/mappers";
import type { ScoreConfig } from "@/lib/score";
import type { PublicCurrentResponse } from "@/lib/types/live";

/** Public data only: event title and the OPEN group (SPEC §9.5). */
export async function getPublicCurrent(rawCode: string): Promise<PublicCurrentResponse | null> {
  const code = parseEventCode(rawCode);
  if (!code) return null;

  const event = await db.event.findUnique({
    where: { code },
    select: {
      title: true,
      status: true,
      rounds: {
        where: { status: "OPEN" },
        take: 1,
        select: { id: true, group: { select: { name: true } } },
      },
    },
  });
  if (!event) return null;

  const open = event.status === "ARCHIVED" ? undefined : event.rounds[0];
  return {
    event: { title: event.title },
    current: open ? { roundId: open.id, groupName: open.group.name } : null,
  };
}

export interface PublicEventForm {
  code: string;
  title: string;
  scoreConfig: ScoreConfig;
}

/** Event info the student form needs to render (score grid). */
export async function getPublicEventForm(rawCode: string): Promise<PublicEventForm | null> {
  const code = parseEventCode(rawCode);
  if (!code) return null;

  const event = await db.event.findUnique({
    where: { code },
    select: { code: true, title: true, minScore: true, maxScore: true, scoreStep: true },
  });
  if (!event) return null;
  return { code: event.code, title: event.title, scoreConfig: toScoreConfig(event) };
}
