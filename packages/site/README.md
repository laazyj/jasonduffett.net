# `@jasonduffett-net/site`

The Eleventy site that gets uploaded to S3 and served via CloudFront. Posts
are Markdown, layouts are Nunjucks.

## Layout

| Path                 | What's there                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/`           | Posts grouped by section: `tech/`, `music/`, `misc/`, plus the standalone `about.md`, `privacy.md`, `index.njk`, `404.md`, `feed.njk`, `sitemap.njk`, `robots.njk`, `llms.njk`. |
| `_data/`             | Site-wide data (`site.json`), per-section series titles, decorative ornaments.                                                                                                  |
| `_includes/`         | Shared layouts and partials.                                                                                                                                                    |
| `assets/`            | Images and static assets that Eleventy fingerprints / processes.                                                                                                                |
| `static/`            | Files copied through unchanged (favicons, IndexNow verification file).                                                                                                          |
| `scripts/`           | Build-time helpers (e.g. open-graph card generation).                                                                                                                           |
| `eleventy.config.js` | Eleventy configuration.                                                                                                                                                         |

Posts are filed by date prefix in the filename (e.g.
`content/tech/2026-03-28-tidy-your-tests-with-ts-fake.md`). Permalinks come
from each section's data file rather than the filename, so changing a post's
slug doesn't break URLs.

## Local development

From the repo root:

```sh
npm run site:start    # hot-reload dev server at http://localhost:8080
npm run site:build    # one-shot build to ./dist
```

Optional environment variables (see [`.env.example`](./.env.example)):

- `GA_MEASUREMENT_ID` — `G-XXXXXXXXXX`. When set at build time, opt-in Google
  Analytics 4 + the cookie consent banner are emitted. Leave unset for an
  analytics-free build.
- `GITHUB_SHA` — baked into a `<meta name="build-sha">` tag. CI sets this
  automatically; locally it's optional.

## Adding a post

1. Create `content/<section>/YYYY-MM-DD-slug.md`.
2. Frontmatter follows the existing posts in that section. To redirect a
   legacy URL, add `originalUrl: /post/123/foo` — the CDK package will pick
   it up next time `redirects.json` is regenerated.
3. `npm run site:start` to preview.

## See also

- [Top-level README](../../README.md) — repo overview, deploy.
- [Content licence](../../LICENSE-content.md) — CC BY 4.0 with carve-outs for
  the profile sketch and any embedded musical works.
