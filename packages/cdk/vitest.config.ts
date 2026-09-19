import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text-summary", "html", "lcov"],

      // Floors set at the measured level rounded down to the whole percent, and
      // a ratchet rather than a target: raise them when coverage rises, never
      // lower them to make a run pass.
      //
      // One package-wide floor is enough here because every file but app.ts is
      // fully covered, and app.ts carries a third of the statements — a real
      // regression in it moves the package number far enough to trip these.
      // (naomi needs per-module floors instead; see its config for why.)
      thresholds: {
        statements: 95,
        branches: 82,
        functions: 97,
        lines: 95,
      },
    },
  },
});
