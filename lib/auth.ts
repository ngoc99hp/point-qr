import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { authConfig } from "@/auth.config";
import { normalizeEmail, verifyAdminCredentials } from "@/lib/admin-credentials";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { LOGIN_PATH } from "@/lib/routes";
import { loginSchema } from "@/lib/validations/auth";

const ADMIN_DEFAULT_NAME = "Admin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const admin = { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD };
        if (!verifyAdminCredentials(parsed.data, admin)) return null;

        const lecturer = await db.lecturer.upsert({
          where: { email: env.ADMIN_EMAIL },
          create: { email: env.ADMIN_EMAIL, name: ADMIN_DEFAULT_NAME },
          update: {},
          select: { id: true, email: true, name: true },
        });
        return { id: lecturer.id, email: lecturer.email, name: lecturer.name };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      // `user` is only present right after a successful sign-in (from authorize).
      if (!user?.id) return token;
      return { ...token, lecturerId: user.id };
    },
  },
});

export interface CurrentLecturer {
  lecturerId: string;
  email: string;
  name: string | null;
}

/**
 * Returns the signed-in admin, or null. Re-checks the email against ADMIN_EMAIL
 * so changing the admin account revokes existing sessions immediately.
 * Use in route handlers (respond 401) — pages and actions use requireLecturer().
 */
export async function getCurrentLecturer(): Promise<CurrentLecturer | null> {
  const session = await auth();
  const email = session?.user.email;
  if (!session || !email || normalizeEmail(email) !== env.ADMIN_EMAIL) return null;

  return {
    lecturerId: session.user.lecturerId,
    email,
    name: session.user.name ?? null,
  };
}

/**
 * Data-access-layer guard for lecturer pages and Server Actions. The proxy only
 * does an optimistic check, so every protected read must go through this.
 */
export async function requireLecturer(): Promise<CurrentLecturer> {
  const lecturer = await getCurrentLecturer();
  if (!lecturer) redirect(LOGIN_PATH);
  return lecturer;
}
