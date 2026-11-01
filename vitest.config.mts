import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node", testTimeout: 60_000 },
  resolve: { alias: { "@": resolve(import.meta.dirname, "./src") } },
});
