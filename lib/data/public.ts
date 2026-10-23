import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { parseEventCode } from "@/lib/event-code";
import { toScoreConfig } from "@/lib/mappers";
import type { ScoreConfig } from "@/lib/score";
import { TICKET_TTL_SECONDS, issueTicket, verifyQrToken } from "@/lib/ticket";
import type { IssuedTicket, PublicCurrentResponse } from "@/lib/types/live";

function ticketFor(roundId: string, groupName: string, now: number): IssuedTicket {
  return {
    value: issueTicket(roundId, env.TICKET_SECRET, now),
    roundId,
    groupName,
    expiresAt: now + TICKET_TTL_SECONDS * 1000,
  };
}

async function findPublicEvent(code: string) {
  return db.event.findUnique({
    where: { code },
    select: {
      id: true,
      title: true,
      status: true,
      rotatingQr: true,
      rounds: { where: { status: "OPEN" }, take: 1, select: { id: true, group: { select: { name: true } } } },
    },
  });
}

/**
 * Public data only: title, QR mode and the OPEN group (SPEC §9.5). Static-QR events
 * (rotatingQr = false) also get a ticket for that round (§9.2).
 */
export async function getPublicCurrent(
  rawCode: string,
  now: number = Date.now(),
): Promise<PublicCurrentResponse | null> {
  const code = parseEventCode(rawCode);
  const event = code ? await findPublicEvent(code) : null;
  if (!event) return null;

  const open = event.status === "ARCHIVED" ? undefined : event.rounds[0];
  return {
    event: { title: event.title, rotatingQr: event.rotatingQr },
    current: open
      ? {
          roundId: open.id,
          groupName: open.group.name,
          ticket: event.rotatingQr ? null : ticketFor(open.id, open.group.name, now),
        }
      : null,
  };
}

/**
 * Rotating QR (§9.1): exchanges the scanned `?t=` token for a ticket when the token
 * is fresh, signed for a round of this event, and that round is still OPEN.
 */
export async function exchangeQrToken(
  rawCode: string,
  token: string | undefined,
  now: number = Date.now(),
): Promise<IssuedTicket | null> {
  const code = parseEventCode(rawCode);
  if (!code || !token) return null;
  const verified = verifyQrToken(token, env.TICKET_SECRET, now);
  if (!verified.ok) return null;

  const round = await db.round.findFirst({
    where: { id: verified.roundId, status: "OPEN", event: { code, status: { not: "ARCHIVED" } } },
    select: { id: true, group: { select: { name: true } } },
  });
  return round ? ticketFor(round.id, round.group.name, now) : null;
}

export interface PublicEventForm {
  code: string;
  title: string;
  rotatingQr: boolean;
  scoreConfig: ScoreConfig;
}

/** Event info the student form needs to render (score grid). */
export async function getPublicEventForm(rawCode: string): Promise<PublicEventForm | null> {
  const code = parseEventCode(rawCode);
  if (!code) return null;

  const event = await db.event.findUnique({
    where: { code },
    select: { code: true, title: true, rotatingQr: true, minScore: true, maxScore: true, scoreStep: true },
  });
  if (!event) return null;
  return { code: event.code, title: event.title, rotatingQr: event.rotatingQr, scoreConfig: toScoreConfig(event) };
}
