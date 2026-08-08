import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // PBKDF2 (210k iters) in the vault test is CPU-heavy; the 5s default is too
    // tight when the full suite runs in parallel under contention.
    testTimeout: 20000,
  },
});
