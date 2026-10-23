import { describe, expect, it } from "vitest";
import {
  QR_WINDOW_SECONDS,
  TICKET_TTL_SECONDS,
  issueTicket,
  signQrToken,
  verifyQrToken,
  verifyTicket,
} from "./ticket";

const SECRET = "s".repeat(48);
const OTHER_SECRET = "o".repeat(48);
const ROUND = "cmround123";
const T0 = Date.UTC(2026, 9, 23, 8, 0, 0); // aligned to a 30 s window

describe("QR token (SPEC §9.1)", () => {
  it("verifies a fresh token and returns its round", () => {
    const token = signQrToken(ROUND, SECRET, T0);
    expect(verifyQrToken(token, SECRET, T0 + 5_000)).toEqual({ ok: true, roundId: ROUND });
  });

  it("accepts the previous window (30–60 s old)", () => {
    const token = signQrToken(ROUND, SECRET, T0);
    expect(verifyQrToken(token, SECRET, T0 + (QR_WINDOW_SECONDS + 29) * 1000)).toEqual({ ok: true, roundId: ROUND });
  });

  it("rejects a token older than 60 s as expired", () => {
    const token = signQrToken(ROUND, SECRET, T0);
    expect(verifyQrToken(token, SECRET, T0 + 2 * QR_WINDOW_SECONDS * 1000)).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects a token from the future", () => {
    const token = signQrToken(ROUND, SECRET, T0 + 120_000);
    expect(verifyQrToken(token, SECRET, T0)).toEqual({ ok: false, reason: "INVALID" });
  });

  it("rejects a wrong signature, tampered round or garbage", () => {
    const token = signQrToken(ROUND, SECRET, T0);
    expect(verifyQrToken(token, OTHER_SECRET, T0)).toEqual({ ok: false, reason: "INVALID" });

    const [, window, signature] = Buffer.from(token, "base64url").toString("utf8").split(".");
    const tampered = Buffer.from(`otherround.${window}.${signature}`, "utf8").toString("base64url");
    expect(verifyQrToken(tampered, SECRET, T0)).toEqual({ ok: false, reason: "INVALID" });

    expect(verifyQrToken("not-a-token", SECRET, T0)).toEqual({ ok: false, reason: "INVALID" });
    expect(verifyQrToken("", SECRET, T0)).toEqual({ ok: false, reason: "INVALID" });
  });
});

describe("ticket (SPEC §9.2)", () => {
  it("verifies within 15 minutes and returns its round and expiry", () => {
    const ticket = issueTicket(ROUND, SECRET, T0);
    expect(verifyTicket(ticket, SECRET, T0 + (TICKET_TTL_SECONDS - 1) * 1000)).toEqual({
      ok: true,
      roundId: ROUND,
      expiresAt: T0 + TICKET_TTL_SECONDS * 1000,
    });
  });

  it("rejects an expired ticket", () => {
    const ticket = issueTicket(ROUND, SECRET, T0);
    expect(verifyTicket(ticket, SECRET, T0 + TICKET_TTL_SECONDS * 1000)).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects a wrong signature and a tampered round (cannot be reused for another round)", () => {
    const ticket = issueTicket(ROUND, SECRET, T0);
    expect(verifyTicket(ticket, OTHER_SECRET, T0)).toEqual({ ok: false, reason: "INVALID" });

    const [, signature] = ticket.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ r: "otherround", iat: T0 / 1000, exp: T0 / 1000 + 900 })).toString("base64url");
    expect(verifyTicket(`${forgedPayload}.${signature}`, SECRET, T0)).toEqual({ ok: false, reason: "INVALID" });
  });

  it("cannot be confused with a QR token (domain separation)", () => {
    const token = signQrToken(ROUND, SECRET, T0);
    const ticket = issueTicket(ROUND, SECRET, T0);
    expect(verifyTicket(token, SECRET, T0)).toEqual({ ok: false, reason: "INVALID" });
    expect(verifyQrToken(ticket, SECRET, T0)).toEqual({ ok: false, reason: "INVALID" });
  });

  it("rejects malformed tickets", () => {
    for (const bad of ["", "abc", "a.b.c", `${Buffer.from("{bad json").toString("base64url")}.sig`]) {
      expect(verifyTicket(bad, SECRET, T0)).toEqual({ ok: false, reason: "INVALID" });
    }
  });
});
