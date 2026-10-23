import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

// SPEC §9.3 / §14 P3: counted in a small table (no Redis). Never by IP: a whole
// class shares one NAT address on the school Wi-Fi.

export type AttemptKind = "SUBMIT" | "CHECK";

/** Per client-chosen deviceId, per event (SPEC §9.3). */
export const RATE_LIMIT_PER_DEVICE: Record<AttemptKind, number> = { SUBMIT: 10, CHECK: 30 };
/**
 * Per ticket: a stolen/static ticket cannot be paired with unlimited fresh deviceIds.
 * Each scan (rotating) or poll (static) yields a distinct ticket, so this only caps abuse.
 */
export const RATE_LIMIT_PER_TICKET: Record<AttemptKind, number> = { SUBMIT: 20, CHECK: 60 };

const WINDOW_MS = 60_000;
const RETENTION_MS = 60 * 60_000;
const PRUNE_PROBABILITY = 1 / 50;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Counts and records one attempt for `subject` atomically (advisory lock per key). */
async function consume(tx: Tx, eventId: string, subject: string, kind: string, limit: number, now: Date) {
  // pg_advisory_xact_lock returns void, which Prisma cannot deserialize; select a constant.
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`${eventId}:${kind}:${subject}`}))`;
  const recent = await tx.submitAttempt.count({
    where: { eventId, deviceId: subject, kind, createdAt: { gt: new Date(now.getTime() - WINDOW_MS) } },
  });
  if (recent >= limit) return false;
  await tx.submitAttempt.create({ data: { eventId, deviceId: subject, kind, createdAt: now }, select: { id: true } });
  return true;
}

/** Ticket strings are long and sensitive; store only a short hash as the subject. */
const ticketSubject = (ticket: string) => `t:${createHash("sha256").update(ticket).digest("base64url").slice(0, 22)}`;

/**
 * Records one attempt and returns false when either the device or the ticket used
 * its quota for the last minute. Occasionally prunes this event's rows older than 1 h.
 */
export async function consumeAttempt(input: {
  eventId: string;
  deviceId: string;
  ticket: string;
  kind: AttemptKind;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const allowed = await db.$transaction(async (tx) => {
    const ticketOk = await consume(tx, input.eventId, ticketSubject(input.ticket), `${input.kind}_TICKET`, RATE_LIMIT_PER_TICKET[input.kind], now);
    if (!ticketOk) return false;
    return consume(tx, input.eventId, input.deviceId, input.kind, RATE_LIMIT_PER_DEVICE[input.kind], now);
  });

  if (Math.random() < PRUNE_PROBABILITY) {
    await db.submitAttempt.deleteMany({
      where: { eventId: input.eventId, createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } },
    });
  }
  return allowed;
}
