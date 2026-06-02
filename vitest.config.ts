import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    environment: "node",
    clearMocks: true,
    passWithNoTests: true,
    // solc compile-verify E2E specs take several seconds and run in parallel; the
    // 5s vitest default flaked under load (and is tighter on slower CI runners).
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
