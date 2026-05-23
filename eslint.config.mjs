// @ts-check
import eslint from "@eslint/js";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig(
  { ignores: ["**/dist/", "**/node_modules/", "**/cdk.out/"] },
  // JS/TS rules, scoped to code files so they don't run against Markdown
  // (the base configs carry no `files` key and would otherwise apply globally
  // now that the Markdown block below makes ESLint lint *.md too).
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.mjs",
            "packages/site/eleventy.config.js",
            "packages/site/scripts/*.mjs",
            "packages/cdk/scripts/*.mjs",
          ],
        },
      },
    },
  },
  {
    files: ["eslint.config.mjs", "packages/site/**/*.{js,mjs,cjs}", "packages/cdk/scripts/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: [
      "packages/cdk/scripts/*.mjs",
      "packages/site/scripts/*.mjs",
      "packages/site/eleventy.config.js",
    ],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        AbortSignal: "readonly",
      },
    },
  },
  // Markdown content rules. Guards the SEO/accessibility regressions that are
  // expressible at the source level: every image needs alt text, one H1 per
  // page. Posts carry YAML frontmatter, so parse it rather than treating the
  // leading `---` as a thematic break.
  //
  // Posts (content/<cat>/*.md) render via post.njk, which emits the frontmatter
  // `title` as the page <h1>, so no-multiple-h1's default — counting that title
  // as an h1 — correctly flags a stray `#` in a post body.
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/gfm",
    languageOptions: { frontmatter: "yaml" },
    rules: {
      "markdown/require-alt-text": "error",
      "markdown/no-multiple-h1": "error",
    },
  },
  // The standalone top-level pages (404, about, privacy) render via base.njk,
  // which does NOT emit the frontmatter title as an <h1>; their single body
  // `# heading` is the real h1. Exclude the title from the h1 count for these.
  {
    files: ["packages/site/content/*.md"],
    rules: {
      "markdown/no-multiple-h1": ["error", { frontmatterTitle: "" }],
    },
  },
  eslintConfigPrettier,
);
