import { describe, expect, it } from "vitest";
import { resolveDirectUrl, toDirectUrl } from "./neon-url";

const POOLED =
  "postgresql://user:p%40ss@ep-example-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const DIRECT =
  "postgresql://user:p%40ss@ep-example-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

describe("toDirectUrl", () => {
  it("removes -pooler from the endpoint host and keeps everything else", () => {
    expect(toDirectUrl(POOLED)).toBe(DIRECT);
  });

  it("leaves a URL that is already direct unchanged", () => {
    expect(toDirectUrl(DIRECT)).toBe(DIRECT);
  });

  it("only touches the host, not the path or credentials", () => {
    const url = "postgresql://my-pooler-user:x@ep-a-pooler.neon.tech/db-pooler";
    expect(toDirectUrl(url)).toBe("postgresql://my-pooler-user:x@ep-a.neon.tech/db-pooler");
  });

  it("returns non-URL input unchanged", () => {
    expect(toDirectUrl("not a url")).toBe("not a url");
  });
});

describe("resolveDirectUrl", () => {
  it("prefers an explicit DIRECT_URL", () => {
    expect(resolveDirectUrl({ DIRECT_URL: DIRECT, DATABASE_URL: "postgresql://x@y/z" })).toBe(
      DIRECT,
    );
  });

  it("derives the direct URL from DATABASE_URL when DIRECT_URL is missing or blank", () => {
    expect(resolveDirectUrl({ DATABASE_URL: POOLED })).toBe(DIRECT);
    expect(resolveDirectUrl({ DATABASE_URL: POOLED, DIRECT_URL: "  " })).toBe(DIRECT);
  });

  it("returns undefined when no database URL is configured", () => {
    expect(resolveDirectUrl({})).toBeUndefined();
  });
});
