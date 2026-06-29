// Stylelint config for the repo's hand-authored CSS (the two Eleventy sites'
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
