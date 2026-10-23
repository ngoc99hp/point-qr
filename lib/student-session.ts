import type { IssuedTicket, PublicCurrentResponse } from "@/lib/types/live";

export type RescanReason = "MISSING" | "EXPIRED" | "NEW_GROUP" | "CLOSED";

export type StudentSession =
  | { kind: "ACTIVE"; ticket: IssuedTicket }
  | { kind: "NO_ROUND" }
  | { kind: "RESCAN"; reason: RescanReason };

/**
 * Which ticket the student form may use right now (SPEC §9.1–9.2, §14 P3).
 * Static QR: the ticket from the latest poll (follows the open group).
 * Rotating QR: only the ticket obtained by scanning, while its round is still open.
 */
export function resolveStudentSession(input: {
  rotatingQr: boolean;
  current: PublicCurrentResponse["current"];
  entryTicket: IssuedTicket | null;
  now: number;
}): StudentSession {
  const { current, entryTicket } = input;
  if (!input.rotatingQr) {
    return current?.ticket ? { kind: "ACTIVE", ticket: current.ticket } : { kind: "NO_ROUND" };
  }
  if (!entryTicket) return current ? { kind: "RESCAN", reason: "MISSING" } : { kind: "NO_ROUND" };
  if (input.now >= entryTicket.expiresAt) return { kind: "RESCAN", reason: "EXPIRED" };
  if (!current) return { kind: "RESCAN", reason: "CLOSED" };
  if (current.roundId !== entryTicket.roundId) return { kind: "RESCAN", reason: "NEW_GROUP" };
  return { kind: "ACTIVE", ticket: entryTicket };
}
