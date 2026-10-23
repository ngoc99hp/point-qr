import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js config shared by proxy.ts and lib/auth.ts.
 * Must not import Prisma, lib/env or any server-only module.
 */
export const authConfig = {
  providers: [Google],
  session: { strategy: "jwt" },
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
