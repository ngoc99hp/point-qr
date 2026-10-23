import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration tests against the main Neon database (SPEC §13, D11). Each test file
 * creates its own data and deletes it afterwards. Run with `pnpm test:integration`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
