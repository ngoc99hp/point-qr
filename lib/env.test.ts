import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RawEnv } from "./env";

const VALID_ENV = {
  DATABASE_URL:
    "postgresql://user:pass@ep-x-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require",
  AUTH_SECRET: "a".repeat(32),
  ADMIN_EMAIL: " Admin@HPU.edu.vn ",
  ADMIN_PASSWORD: "p".repeat(16),
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

  it("parses a valid environment and normalizes the admin email", async () => {
    const parseEnv = await loadParseEnv();

    const env = parseEnv(VALID_ENV);

    expect(env.ADMIN_EMAIL).toBe("admin@hpu.edu.vn");
    expect(env.ADMIN_PASSWORD).toBe(VALID_ENV.ADMIN_PASSWORD);
    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
  });

  it("does not require DIRECT_URL at runtime", async () => {
    const parseEnv = await loadParseEnv();

    expect(() => parseEnv(VALID_ENV)).not.toThrow();
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
        ADMIN_EMAIL: undefined,
      });

    expect(run).toThrow(/DATABASE_URL/);
    expect(run).toThrow(/TICKET_SECRET/);
    expect(run).toThrow(/ADMIN_EMAIL/);
    expect(run).not.toThrow(new RegExp(secretValue));
  });

  it("rejects secrets shorter than 32 characters", async () => {
    const parseEnv = await loadParseEnv();

    expect(() => parseEnv({ ...VALID_ENV, AUTH_SECRET: "a".repeat(31) })).toThrow(
      /AUTH_SECRET/,
    );
  });

  it("rejects an invalid admin email", async () => {
    const parseEnv = await loadParseEnv();

    expect(() => parseEnv({ ...VALID_ENV, ADMIN_EMAIL: "not-an-email" })).toThrow(
      /ADMIN_EMAIL/,
    );
  });

  it("rejects an admin password shorter than 16 characters", async () => {
    const parseEnv = await loadParseEnv();

    expect(() => parseEnv({ ...VALID_ENV, ADMIN_PASSWORD: "p".repeat(15) })).toThrow(
      /ADMIN_PASSWORD/,
    );
  });
});
