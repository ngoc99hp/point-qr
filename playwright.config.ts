import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Credentials and DATABASE_URL come from .env.local (same as `pnpm dev`).
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const PORT = 3300;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E (SPEC §13) against a production build (`pnpm test:e2e` builds first) and the
 * main Neon DB (D11). Each test creates its own "[TEST]" event and deletes it.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
  },
  projects: [{ name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { AUTH_TRUST_HOST: "true", NEXT_PUBLIC_APP_URL: BASE_URL },
  },
});
