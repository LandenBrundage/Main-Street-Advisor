import path from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // UI tests remain fast in isolation, but cold module transforms can exceed
    // Vitest's five-second default when the full suite runs concurrently.
    testTimeout: 15_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
