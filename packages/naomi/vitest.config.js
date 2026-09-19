import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["scripts/**/*.mjs", "_data/**/*.js"],
      reporter: ["text-summary", "html", "lcov"],

      // A floor per module, set at the measured level rounded down to the whole
      // percent. Per-module rather than one package-wide number because two of
      // the six files are entrypoints no test imports — build-sheet.mjs, driven
      // by `npm run naomi:pdf`, and _data/sheet.js, which Eleventy calls during
      // a build. Blending their 0% into a package-wide floor would drag it low
      // enough that a real regression in a tested module still cleared it.
      //
      // The floors are a ratchet, not a target: raise them when coverage rises,
      // never lower them to make a run pass. Files matched by a glob below are
      // judged only against it; the entrypoints fall to the package-wide zeros
      // and stay in the report so their state is visible rather than hidden.
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
        "_data/matrix.js": { statements: 78, branches: 56, functions: 92, lines: 93 },
        "scripts/sheet-checks.mjs": { statements: 77, branches: 57, functions: 88, lines: 80 },
        "scripts/sheet-file.mjs": { statements: 92, branches: 100, functions: 0, lines: 100 },
        "scripts/sheet-manifest.mjs": { statements: 35, branches: 16, functions: 50, lines: 33 },
      },
    },
  },
});
