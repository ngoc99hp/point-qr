import { z } from "zod";

const MAX_PASSWORD_LENGTH = 256;

export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

export type LoginInput = z.infer<typeof loginSchema>;
