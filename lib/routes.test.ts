import { describe, expect, it } from "vitest";
import { getRouteAccess, HOME_PATH, safeCallbackUrl } from "./routes";

describe("getRouteAccess", () => {
  it.each([
    "/r/ABC234",
    "/r/ABC234/anything",
    "/api/public/events/ABC234/current",
    "/api/auth/signin",
    "/api/auth/callback/google",
  ])("treats %s as public", (pathname) => {
    expect(getRouteAccess(pathname)).toBe("public");
  });

  it("identifies the login page", () => {
    expect(getRouteAccess("/login")).toBe("login");
  });

  it.each(["/", "/events", "/events/abc/live", "/rabbit", "/loginx", "/r"])(
    "protects page %s",
    (pathname) => {
      expect(getRouteAccess(pathname)).toBe("protected-page");
    },
  );

  it.each(["/api/events/abc/live", "/api/publicity", "/api/authx"])(
    "protects api %s",
    (pathname) => {
      expect(getRouteAccess(pathname)).toBe("protected-api");
    },
  );
});

describe("safeCallbackUrl", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeCallbackUrl("/events/abc?tab=1")).toBe("/events/abc?tab=1");
  });

  it.each([
    undefined,
    "",
    "https://evil.example.com",
    "//evil.example.com",
    "/\\evil.example.com",
    "events",
    "/login",
  ])("falls back to home for %s", (value) => {
    expect(safeCallbackUrl(value)).toBe(HOME_PATH);
  });
});
