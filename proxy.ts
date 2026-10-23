import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { getRouteAccess, HOME_PATH, LOGIN_PATH } from "@/lib/routes";

const { auth } = NextAuth(authConfig);

// Optimistic check only; pages and actions still verify via requireLecturer().
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const access = getRouteAccess(pathname);
  const isSignedIn = req.auth !== null;

  if (access === "public") return NextResponse.next();

  if (access === "login") {
    return isSignedIn
      ? NextResponse.redirect(new URL(HOME_PATH, req.nextUrl))
      : NextResponse.next();
  }

  if (isSignedIn) return NextResponse.next();

  if (access === "protected-api") {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Chưa đăng nhập." } },
      { status: 401 },
    );
  }

  const loginUrl = new URL(LOGIN_PATH, req.nextUrl);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // Skip Next internals and static assets only. Other dotted paths
  // (e.g. /api/.../export.csv) still go through the default-deny check.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|webmanifest|woff2?)$).*)",
  ],
};
