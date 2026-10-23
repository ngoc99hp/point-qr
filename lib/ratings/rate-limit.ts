import "server-only";
import { db } from "@/lib/db";

// SPEC §9.3 / §14 P3: per device and event, counted in a small table (no Redis).
// Never by IP: a whole class shares one NAT address on the school Wi-Fi.

export type AttemptKind = "SUBMIT" | "CHECK";

export const RATE_LIMIT_PER_MINUTE: Record<AttemptKind, number> = { SUBMIT: 10, CHECK: 30 };
const WINDOW_MS = 60_000;
const RETENTION_MS = 60 * 60_000;

/**
 * Records one attempt and returns false when the device already used its quota
 * for the last minute. Prunes this event's rows older than one hour as it goes.
 */
export async function consumeAttempt(
  eventId: string,
  deviceId: string,
  kind: AttemptKind,
  now: Date = new Date(),
): Promise<boolean> {
  const recent = await db.submitAttempt.count({
    where: { eventId, deviceId, kind, createdAt: { gt: new Date(now.getTime() - WINDOW_MS) } },
  });
  if (recent >= RATE_LIMIT_PER_MINUTE[kind]) return false;

  await db.$transaction([
    db.submitAttempt.create({ data: { eventId, deviceId, kind, createdAt: now }, select: { id: true } }),
    db.submitAttempt.deleteMany({
      where: { eventId, createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } },
    }),
  ]);
  return true;
}
