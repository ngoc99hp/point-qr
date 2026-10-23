import "server-only";
import { fail } from "@/lib/action-result";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { consumeAttempt, type AttemptKind } from "@/lib/ratings/rate-limit";
import { verifyTicket } from "@/lib/ticket";

export const RESCAN_MESSAGE = "Vui lòng quét lại mã QR trên màn chiếu.";
export const RATE_LIMITED_MESSAGE = "Bạn gửi quá nhanh. Vui lòng đợi một chút rồi thử lại.";

export type GateFailureCode = "TICKET_INVALID" | "TICKET_EXPIRED" | "RATE_LIMITED";

export type GateResult =
  | { ok: true; roundId: string; eventId: string }
  | { ok: false; failure: ReturnType<typeof fail<GateFailureCode>> };

/**
 * Shared entry check for public student calls (SPEC §7 steps 2–3):
 * verify the ticket (§9.2), resolve the event by code, then rate limit by device (§9.3).
 * The round itself is re-checked (belongs to the event, OPEN) by the caller.
 */
export async function passTicketGate(input: {
  eventCode: string;
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

  const event = await db.event.findUnique({ where: { code: input.eventCode }, select: { id: true } });
  if (!event) return { ok: false, failure: fail("TICKET_INVALID", RESCAN_MESSAGE) };

  if (!(await consumeAttempt(event.id, input.deviceId, input.kind))) {
    return { ok: false, failure: fail("RATE_LIMITED", RATE_LIMITED_MESSAGE) };
  }
  return { ok: true, roundId: verified.roundId, eventId: event.id };
}
