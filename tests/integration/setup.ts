import { existsSync } from "node:fs";

// Load DATABASE_URL etc. before lib/env and lib/db are imported by the tests.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
