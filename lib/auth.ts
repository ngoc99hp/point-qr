import "server-only";
import NextAuth from "next-auth";
import { redirect } from "next/navigation";
import { authConfig } from "@/auth.config";
import { isAllowedLecturer, normalizeEmail } from "@/lib/allowlist";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      // Returning false redirects to /login?error=AccessDenied.
      return isAllowedLecturer(
        { email: profile?.email, emailVerified: profile?.email_verified },
        env.ALLOWED_LECTURER_EMAILS,
      );
    },
    async jwt({ token, user }) {
      // `user` is only present right after a successful sign-in.
      if (!user?.email) return token;

      const email = normalizeEmail(user.email);
      const name = user.name ?? null;
      const lecturer = await db.lecturer.upsert({
        where: { email },
        create: { email, name },
        update: { name },
        select: { id: true },
      });
      return { ...token, lecturerId: lecturer.id };
    },
  },
});

export interface CurrentLecturer {
  lecturerId: string;
  email: string;
  name: string | null;
}

/**
 * Data-access-layer guard for lecturer pages and actions. The proxy only does an
 * optimistic check, so every protected read must go through this function.
 */
export async function requireLecturer(): Promise<CurrentLecturer> {
  const session = await auth();
  const email = session?.user.email;
  if (!session || !email) redirect("/login");

  return {
    lecturerId: session.user.lecturerId,
    email,
    name: session.user.name ?? null,
  };
}
