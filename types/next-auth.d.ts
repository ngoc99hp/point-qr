import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      lecturerId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Set by the jwt callback at sign-in (lib/auth.ts). */
    lecturerId?: string;
  }
}
