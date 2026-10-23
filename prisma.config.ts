import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env files; use Node's built-in loader (no dotenv).
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // The CLI (migrate/deploy/studio) uses the DIRECT connection, not the pooler.
  // Read process.env instead of env() so `prisma generate` (postinstall, Vercel build)
  // works without a database URL; migrate commands still fail if it is missing.
  datasource: { url: process.env.DIRECT_URL },
});
