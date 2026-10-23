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

/** Ticket strings are long and sensitive; store only a short hash as the subject. */
const ticketSubject = (ticket: string) => `t:${createHash("sha256").update(ticket).digest("base64url").slice(0, 22)}`;

interface Bucket {
  subject: string;
  kind: string;
  limit: number;
}

/**
 * Records one attempt and returns false when either the ticket or the device used
 * its quota for the last minute. Three statements in one transaction: lock both
 * buckets (advisory locks, always in the same order), count both, insert both.
 */
export async function consumeAttempt(input: {
  eventId: string;
  deviceId: string;
  ticket: string;
  kind: AttemptKind;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const buckets: Bucket[] = [
    { subject: ticketSubject(input.ticket), kind: `${input.kind}_TICKET`, limit: RATE_LIMIT_PER_TICKET[input.kind] },
    { subject: input.deviceId, kind: input.kind, limit: RATE_LIMIT_PER_DEVICE[input.kind] },
  ];
  const [ticketKey, deviceKey] = buckets.map((bucket) => `${input.eventId}:${bucket.kind}:${bucket.subject}`);

  const allowed = await db.$transaction(async (tx) => {
    // pg_advisory_xact_lock returns void, which Prisma cannot deserialize; select a constant.
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${ticketKey})), pg_advisory_xact_lock(hashtext(${deviceKey}))) AS locks`;
    const counts = await tx.submitAttempt.groupBy({
      by: ["deviceId", "kind"],
      where: {
        eventId: input.eventId,
        createdAt: { gt: new Date(now.getTime() - WINDOW_MS) },
        OR: buckets.map((bucket) => ({ deviceId: bucket.subject, kind: bucket.kind })),
      },
      _count: { _all: true },
    });
    const countOf = (bucket: Bucket) =>
      counts.find((row) => row.deviceId === bucket.subject && row.kind === bucket.kind)?._count._all ?? 0;
    if (buckets.some((bucket) => countOf(bucket) >= bucket.limit)) return false;

    await tx.submitAttempt.createMany({
      data: buckets.map((bucket) => ({ eventId: input.eventId, deviceId: bucket.subject, kind: bucket.kind, createdAt: now })),
    });
    return true;
  });

  if (Math.random() < PRUNE_PROBABILITY) {
    await db.submitAttempt.deleteMany({
      where: { eventId: input.eventId, createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } },
    });
  }
  return allowed;
}
