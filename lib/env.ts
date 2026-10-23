import "server-only";
import { z } from "zod";

const MIN_SECRET_LENGTH = 32;
const MIN_ADMIN_PASSWORD_LENGTH = 16;

// DIRECT_URL is intentionally absent: only the Prisma CLI needs it (prisma.config.ts).
const envSchema = z.object({
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(MIN_SECRET_LENGTH),
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  ADMIN_PASSWORD: z.string().min(MIN_ADMIN_PASSWORD_LENGTH),
  TICKET_SECRET: z.string().min(MIN_SECRET_LENGTH),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

export type RawEnv = Record<string, string | undefined>;

/**
 * Validates raw environment variables. Throws an error that lists only the
 * names of invalid variables, never their values.
 */
export function parseEnv(raw: RawEnv): Env {
  const result = envSchema.safeParse(raw);
  if (result.success) return result.data;

  const invalidKeys = [
    ...new Set(result.error.issues.map((issue) => issue.path.join(".") || "(root)")),
  ];
  throw new Error(
    `Invalid environment variables: ${invalidKeys.join(", ")}. See .env.example.`,
  );
}

export const env: Env = parseEnv(process.env);
