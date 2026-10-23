export const LOGIN_PATH = "/login";
export const HOME_PATH = "/events";

/** Routes reachable without a lecturer session (SPEC §6). */
const PUBLIC_PREFIXES = ["/r", "/api/public", "/api/auth"] as const;

export type RouteAccess = "public" | "login" | "protected-page" | "protected-api";

function isUnder(pathname: string, prefix: string): boolean {
  return pathname.startsWith(`${prefix}/`);
}

/** Default-deny: anything not explicitly public requires a lecturer session. */
export function getRouteAccess(pathname: string): RouteAccess {
  if (PUBLIC_PREFIXES.some((prefix) => isUnder(pathname, prefix))) return "public";
  if (pathname === LOGIN_PATH) return "login";
  if (pathname === "/api" || isUnder(pathname, "/api")) return "protected-api";
  return "protected-page";
}

/** Only allow same-origin relative paths as post-login redirect targets. */
export function safeCallbackUrl(value: string | undefined): string {
  if (!value || !value.startsWith("/")) return HOME_PATH;
  if (value.startsWith("//") || value.startsWith("/\\")) return HOME_PATH;
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) return HOME_PATH;
  return value;
}
