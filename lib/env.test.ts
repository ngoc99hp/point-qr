import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RawEnv } from "./env";

const VALID_ENV = {
  DATABASE_URL:
    "postgresql://user:pass@ep-x-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require",
  DIRECT_URL:
    "postgresql://user:pass@ep-x.ap-southeast-1.aws.neon.tech/db?sslmode=require",
  AUTH_SECRET: "a".repeat(32),
  AUTH_GOOGLE_ID: "google-id",
  AUTH_GOOGLE_SECRET: "google-secret",
  ALLOWED_LECTURER_EMAILS: " A@hpu.edu.vn, b@hpu.edu.vn ,,",
  TICKET_SECRET: "t".repeat(32),
  NEXT_PUBLIC_APP_URL: "https://peerscore.example.com",
} satisfies RawEnv;

async function loadParseEnv() {
  const mod = await import("./env");
  return mod.parseEnv;
}

describe("lib/env", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries(VALID_ENV)) {
      vi.stubEnv(key, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses a valid environment and normalizes the email allowlist", async () => {
    const parseEnv = await loadParseEnv();

    const env = parseEnv(VALID_ENV);

    expect(env.ALLOWED_LECTURER_EMAILS).toEqual(["a@hpu.edu.vn", "b@hpu.edu.vn"]);
    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
  });

  it("exports a validated env constant from process.env", async () => {
    const { env } = await import("./env");

    expect(env.TICKET_SECRET).toBe(VALID_ENV.TICKET_SECRET);
  });

  it("fails fast at import time when a required variable is missing", async () => {
    vi.stubEnv("AUTH_SECRET", undefined);

    await expect(import("./env")).rejects.toThrow(/AUTH_SECRET/);
  });

  it("lists every invalid variable name without leaking values", async () => {
    const parseEnv = await loadParseEnv();
    const secretValue = "short-secret-value";

    const run = () =>
      parseEnv({
        ...VALID_ENV,
        DATABASE_URL: "not-a-url",
        TICKET_SECRET: secretValue,
        AUTH_GOOGLE_ID: undefined,
      });

    expect(run).toThrow(/DATABASE_URL/);
    expect(run).toThrow(/TICKET_SECRET/);
    expect(run).toThrow(/AUTH_GOOGLE_ID/);
    expect(run).not.toThrow(new RegExp(secretValue));
  });

  it("rejects secrets shorter than 32 characters", async () => {
    const parseEnv = await loadParseEnv();

    expect(() => parseEnv({ ...VALID_ENV, AUTH_SECRET: "a".repeat(31) })).toThrow(
      /AUTH_SECRET/,
    );
  });

  it("rejects an allowlist that is empty or contains an invalid email", async () => {
    const parseEnv = await loadParseEnv();

    expect(() => parseEnv({ ...VALID_ENV, ALLOWED_LECTURER_EMAILS: " , " })).toThrow(
      /ALLOWED_LECTURER_EMAILS/,
    );
    expect(() =>
      parseEnv({ ...VALID_ENV, ALLOWED_LECTURER_EMAILS: "a@hpu.edu.vn,not-an-email" }),
    ).toThrow(/ALLOWED_LECTURER_EMAILS/);
  });
});
