import "server-only";
import { fail } from "@/lib/action-result";
import { env } from "@/lib/env";
import { isForeignKeyViolation } from "@/lib/prisma-errors";
import { consumeAttempt, type AttemptKind } from "@/lib/ratings/rate-limit";
import { verifyTicket } from "@/lib/ticket";

export const RESCAN_MESSAGE = "Vui lòng quét lại mã QR trên màn chiếu.";
export const RATE_LIMITED_MESSAGE = "Bạn gửi quá nhanh. Vui lòng đợi một chút rồi thử lại.";

export type GateFailureCode = "TICKET_INVALID" | "TICKET_EXPIRED" | "RATE_LIMITED";

export type GateResult =
  | { ok: true; roundId: string; eventId: string }
  | { ok: false; failure: ReturnType<typeof fail<GateFailureCode>> };

/**
 * Shared entry check for public student calls (SPEC §7 steps 2–3): verify the
 * ticket (§9.2, which carries its signed eventId) and rate limit by device and
 * ticket (§9.3). The caller re-checks that the round belongs to the event and is OPEN.
 */
export async function passTicketGate(input: {
  ticket: string;
  deviceId: string;
  kind: AttemptKind;
  now?: number;
}): Promise<GateResult> {
  const verified = verifyTicket(input.ticket, env.TICKET_SECRET, input.now ?? Date.now());
  if (!verified.ok) {
    const code = verified.reason === "EXPIRED" ? "TICKET_EXPIRED" : "TICKET_INVALID";
    return { ok: false, failure: fail(code, RESCAN_MESSAGE) };
  }

  let allowed: boolean;
  try {
    allowed = await consumeAttempt({
      eventId: verified.eventId,
      deviceId: input.deviceId,
      ticket: input.ticket,
      kind: input.kind,
    });
  } catch (error) {
    // A validly signed ticket whose event was deleted since it was issued.
    if (isForeignKeyViolation(error)) return { ok: false, failure: fail("TICKET_INVALID", RESCAN_MESSAGE) };
    throw error;
  }
  if (!allowed) return { ok: false, failure: fail("RATE_LIMITED", RATE_LIMITED_MESSAGE) };
  return { ok: true, roundId: verified.roundId, eventId: verified.eventId };
}
