import "server-only";
import { z } from "zod";

const MIN_SECRET_LENGTH = 32;

const emailList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  )
  .pipe(z.array(z.email()).min(1, "Cần ít nhất 1 email"));

const envSchema = z.object({
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),
  AUTH_SECRET: z.string().min(MIN_SECRET_LENGTH),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  ALLOWED_LECTURER_EMAILS: emailList,
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
    ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
  ];
  throw new Error(
    `Invalid environment variables: ${invalidKeys.join(", ")}. See .env.example.`,
  );
}

export const env: Env = parseEnv(process.env);
