import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";
import { resolveDirectUrl } from "./lib/neon-url";

// Prisma 7 no longer loads .env files; use Node's built-in loader (no dotenv).
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // The CLI (migrate/deploy/studio) uses the DIRECT connection, not the pooler.
  // DIRECT_URL is optional: otherwise it is derived from DATABASE_URL by dropping
  // "-pooler" from the host. Read process.env (not env()) so `prisma generate`
  // works without any database URL; migrate commands still fail if none is set.
  datasource: { url: resolveDirectUrl(process.env) },
});
