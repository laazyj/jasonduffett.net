# naomi.jasonduffett.net

Single-page Eleventy site for **NAOMI** — the Native AI Operational Maturity
Index. Deployed as a subsite of `jasonduffett.net`, on its own hosted zone,
certificate, bucket and CloudFront distribution
(see [`packages/cdk/src/subsite.ts`](../cdk/src/subsite.ts)).

```sh
npm run naomi:start   # hot-reload dev server
npm run naomi:build   # write ./dist
```

## Layout

| Path                  | What it holds                                                     |
| --------------------- | ----------------------------------------------------------------- |
| `_data/site.json`     | Title, description, copyright, outbound links, and the PDF entry. |
| `_data/matrix.json`   | The index itself: maturity levels and dimensions.                 |
| `_includes/partials/` | Head, footer, analytics, consent banner, and the matrix table.    |
| `content/index.njk`   | The single page — hero, matrix, notes, download, links.           |
| `assets/styles.css`   | All styling. Shipped verbatim; no build step.                     |

## Content status

The dimensions and level descriptors in `_data/matrix.json` are **placeholder
scaffolding**. While `"status": "placeholder"` is set, the page renders a draft
notice above the matrix; remove that field once the real wording lands.

The PDF is not published yet. `site.pdf` is `null`, which renders the download
card in a disabled state. To publish it, drop the file in `assets/` and set:

```json
"pdf": { "path": "/assets/naomi.pdf", "label": "The printable index", "size": "1.2 MB" }
```

Licensing for the index content is deliberately unresolved: the pages carry an
all-rights-reserved copyright notice and `tdm-reservation: 1`, and `site.copyrightUrl`
is `null` so no licence document is linked. Point it at one when the terms are
decided.

## Analytics

Set `NAOMI_GA_MEASUREMENT_ID` at build time to enable Google Analytics 4 and the
cookie consent banner — a separate GA4 property from the apex site and from
Clara's subsite. Leave it unset to ship without any analytics. See
[`.env.example`](.env.example).
