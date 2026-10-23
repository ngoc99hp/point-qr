import { describe, expect, it } from "vitest";
import { resolveStudentSession } from "./student-session";
import type { IssuedTicket, PublicCurrentResponse } from "./types/live";

const NOW = 1_000_000;
const ticket = (roundId: string, expiresAt = NOW + 60_000): IssuedTicket => ({
  value: `ticket-${roundId}`,
  roundId,
  groupName: `Group ${roundId}`,
  expiresAt,
});
const current = (roundId: string, issued: IssuedTicket | null = null): PublicCurrentResponse["current"] => ({
  roundId,
  groupName: `Group ${roundId}`,
  ticket: issued,
});

describe("resolveStudentSession — static QR", () => {
  it("uses the ticket from the latest poll so the page follows the open group", () => {
    const issued = ticket("r2");
    expect(resolveStudentSession({ rotatingQr: false, current: current("r2", issued), entryTicket: null, now: NOW })).toEqual({
      kind: "ACTIVE",
      ticket: issued,
    });
  });

  it("waits when nothing is open", () => {
    expect(resolveStudentSession({ rotatingQr: false, current: null, entryTicket: null, now: NOW })).toEqual({ kind: "NO_ROUND" });
  });
});

describe("resolveStudentSession — rotating QR", () => {
  it("uses the ticket obtained by scanning while its round is still open", () => {
    const scanned = ticket("r1");
    expect(resolveStudentSession({ rotatingQr: true, current: current("r1"), entryTicket: scanned, now: NOW })).toEqual({
      kind: "ACTIVE",
      ticket: scanned,
    });
  });

  it("asks to scan when the page was opened without a valid token", () => {
    expect(resolveStudentSession({ rotatingQr: true, current: current("r1"), entryTicket: null, now: NOW })).toEqual({
      kind: "RESCAN",
      reason: "MISSING",
    });
    expect(resolveStudentSession({ rotatingQr: true, current: null, entryTicket: null, now: NOW })).toEqual({ kind: "NO_ROUND" });
  });

  it("asks to scan again when another group was opened", () => {
    expect(resolveStudentSession({ rotatingQr: true, current: current("r2"), entryTicket: ticket("r1"), now: NOW })).toEqual({
      kind: "RESCAN",
      reason: "NEW_GROUP",
    });
  });

  it("reports a closed round and an expired ticket", () => {
    expect(resolveStudentSession({ rotatingQr: true, current: null, entryTicket: ticket("r1"), now: NOW })).toEqual({
      kind: "RESCAN",
      reason: "CLOSED",
    });
    expect(
      resolveStudentSession({ rotatingQr: true, current: current("r1"), entryTicket: ticket("r1", NOW), now: NOW }),
    ).toEqual({ kind: "RESCAN", reason: "EXPIRED" });
  });
});
