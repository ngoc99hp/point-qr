// Pure QR token + ticket signing (SPEC §9.1, §9.2). `secret` and `now` (ms) are
// parameters so the logic is unit-testable; callers pass env.TICKET_SECRET and Date.now().
import { createHmac, timingSafeEqual } from "node:crypto";

export const QR_WINDOW_SECONDS = 30;
export const TICKET_TTL_SECONDS = 15 * 60;
const QR_SIGNATURE_LENGTH = 16;

export type VerifyFailure = { ok: false; reason: "INVALID" | "EXPIRED" };

/** Domain-separated HMAC so a QR token can never verify as a ticket or vice versa. */
function hmac(secret: string, domain: "qr" | "ticket", message: string): string {
  return createHmac("sha256", secret).update(`${domain}:${message}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const qrWindow = (now: number) => Math.floor(now / 1000 / QR_WINDOW_SECONDS);

/** token = base64url(roundId + "." + window + "." + HMAC(roundId.window).slice(0, 16)) */
export function signQrToken(roundId: string, secret: string, now: number): string {
  const window = qrWindow(now);
  const signature = hmac(secret, "qr", `${roundId}.${window}`).slice(0, QR_SIGNATURE_LENGTH);
  return Buffer.from(`${roundId}.${window}.${signature}`, "utf8").toString("base64url");
}

/** Valid for the current and the previous 30 s window (30–60 s). */
export function verifyQrToken(
  token: string,
  secret: string,
  now: number,
): { ok: true; roundId: string } | VerifyFailure {
  const parts = Buffer.from(token, "base64url").toString("utf8").split(".");
  const [roundId, windowText, signature] = parts;
  if (parts.length !== 3 || !roundId || !windowText || !signature || !/^\d+$/.test(windowText)) {
    return { ok: false, reason: "INVALID" };
  }
  const expected = hmac(secret, "qr", `${roundId}.${windowText}`).slice(0, QR_SIGNATURE_LENGTH);
  if (!safeEqual(signature, expected)) return { ok: false, reason: "INVALID" };

  const window = Number(windowText);
  const current = qrWindow(now);
  if (window > current) return { ok: false, reason: "INVALID" };
  if (window < current - 1) return { ok: false, reason: "EXPIRED" };
  return { ok: true, roundId };
}

interface TicketPayload {
  /** roundId */
  r: string;
  /** eventId — binds the ticket to its event and spares a lookup by code. */
  e: string;
  iat: number;
  exp: number;
}

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

function isTicketPayload(value: unknown): value is TicketPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "r" in value &&
    "e" in value &&
    "iat" in value &&
    "exp" in value &&
    isNonEmptyString(value.r) &&
    isNonEmptyString(value.e) &&
    typeof value.iat === "number" &&
    typeof value.exp === "number"
  );
}

/** ticket = base64url(JSON{ r, e, iat, exp }) + "." + base64url(HMAC) — valid 15 minutes. */
export function issueTicket(round: { roundId: string; eventId: string }, secret: string, now: number): string {
  const iat = Math.floor(now / 1000);
  const payload: TicketPayload = { r: round.roundId, e: round.eventId, iat, exp: iat + TICKET_TTL_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${hmac(secret, "ticket", encoded)}`;
}

export function verifyTicket(
  ticket: string,
  secret: string,
  now: number,
): { ok: true; roundId: string; eventId: string; expiresAt: number } | VerifyFailure {
  const parts = ticket.split(".");
  const [encoded, signature] = parts;
  if (parts.length !== 2 || !encoded || !signature) return { ok: false, reason: "INVALID" };
  if (!safeEqual(signature, hmac(secret, "ticket", encoded))) return { ok: false, reason: "INVALID" };

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "INVALID" };
  }
  if (!isTicketPayload(payload)) return { ok: false, reason: "INVALID" };
  if (Math.floor(now / 1000) >= payload.exp) return { ok: false, reason: "EXPIRED" };
  return { ok: true, roundId: payload.r, eventId: payload.e, expiresAt: payload.exp * 1000 };
}
