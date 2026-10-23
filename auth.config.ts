import type { NextAuthConfig } from "next-auth";

/** The admin re-authenticates after 12 hours (one teaching day). */
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

/**
 * Edge-safe Auth.js config shared by proxy.ts and lib/auth.ts.
 * Must not import Prisma, lib/env or any server-only module. The Credentials
 * provider lives in lib/auth.ts; the proxy only needs to decode the JWT.
 */
export const authConfig = {
  providers: [],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    session({ session, token }) {
      if (!token.lecturerId) {
        // Auth.js clears the cookie and treats the request as signed out.
        throw new Error("Session token is missing lecturerId");
      }
      return { ...session, user: { ...session.user, lecturerId: token.lecturerId } };
    },
  },
} satisfies NextAuthConfig;
