import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./", import.meta.url)),
  // `server-only` throws outside React Server Components; tests run in plain Node.
  "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
};

/** Unit tests only — no database needed. Integration tests: vitest.integration.config.ts. */
export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "lib/generated/**", "tests/integration/**"],
  },
});
