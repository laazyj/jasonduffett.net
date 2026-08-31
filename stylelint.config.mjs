// Stylelint config for the repo's hand-authored CSS (each Eleventy site's
// assets/styles.css). Runs via `npm run lint:css`, folded into `npm run lint`
// alongside ESLint, so CI's `npm run verify` gates on it too.
//
// stylelint-config-standard carries the community conventions; Prettier still
// owns whitespace/formatting (modern Stylelint dropped its stylistic rules, so
// the two don't fight). The overrides below switch off the handful of standard
// rules that clash with deliberate choices in this codebase.
export default {
  extends: ["stylelint-config-standard"],

  // Mirror ESLint's ignores — only lint source CSS, never build output or deps.
  ignoreFiles: ["**/dist/**", "**/node_modules/**", "**/cdk.out/**"],

  // Teach Stylelint's value-syntax database the one prefixed function we hand-
  // write. These sites ship CSS verbatim (no Autoprefixer), so the older-Safari
  // `-webkit-image-set()` fallback is authored by hand — but Stylelint's grammar
  // only knows the unprefixed `image-set()`, so `declaration-property-value-no-
  // unknown` rejects it as an unknown value. Rather than silence the rule, we
  // extend the grammar: define the prefixed function in terms of the existing
  // `<image-set-option>` type and add it to `background-image`. The rule stays
  // fully active and still validates the function's arguments (a malformed
  // `-webkit-image-set(1px 2px)` is caught) — we've only widened what it knows.
  languageOptions: {
    syntax: {
      types: {
        "-webkit-image-set()": "-webkit-image-set( <image-set-option># )",
      },
      properties: {
        "background-image": "| <-webkit-image-set()>",
      },
    },
  },

  rules: {
    // These sites ship CSS verbatim through Eleventy's passthrough copy — there
    // is no Autoprefixer/PostCSS step — so vendor prefixes are written by hand
    // and are load-bearing (e.g. `-webkit-background-clip: text`, and the
    // `-webkit-image-set()` fallback older Safari needs). Don't flag them.
    "property-no-vendor-prefix": null,
    "value-no-vendor-prefix": null,

    // The sites use BEM-style modifier classes (`.consent-btn--ghost`,
    // `.site--story`) whose `--` trips the default kebab-case pattern. The
    // class names are contracts with the Nunjucks templates, so keep them.
    "selector-class-pattern": null,

    // Noisy and not auto-fixable: the only fix is reordering rules, which
    // changes the cascade and risks visual regressions. Not worth the churn.
    "no-descending-specificity": null,
  },
};
