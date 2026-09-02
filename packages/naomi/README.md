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

| Path                  | What it holds                                                                  |
| --------------------- | ------------------------------------------------------------------------------ |
| `_data/site.json`     | Title, description, version, draft flag, lede, copyright, links, article, PDF. |
| `_includes/layouts/`  | The base layout: masthead, page slot, footer, consent banner.                  |
| `_includes/partials/` | Head, footer, analytics, consent banner.                                       |
| `content/index.njk`   | The single page — lede, index, notes, background, download, links.             |
| `assets/styles.css`   | All styling. Shipped verbatim; no build step.                                  |
| `static/`             | Files served from the site root: `favicon.svg`, the IndexNow key.              |

## Status

The index itself is **not on the page yet**. `content/index.njk` renders a
"coming soon" panel in the footprint the matrix will occupy; everything around
it — masthead, type, palette, sections, footer — is the finished frame. The
prose is provisional placeholder while the index is written.

`site.draft` gates the draft notice. Set it to `false` when the copy is real.
`site.lede` is the standing description of the model; it renders beside the
wordmark in the masthead on the home page, the way the intro sits beside it on
the printed sheet.

When the matrix lands it wants its own `_data/*.json` source and a partial
rendering from it, so the wording stays editable as data rather than markup.
Note that the cell wording will then exist twice — here, and inline in the
introductory article at
`packages/site/content/tech/2026-08-30-naomi-ai-native-maturity-model.md`.
Decide which one is canonical before the second copy is written.

The page is one wide frame, sized for the matrix rather than for prose, with
three separate widths in `assets/styles.css`:

- `--frame` (72rem) is the page. The matrix gets all of it.
- `--measure` (40rem) is how wide prose is allowed to set.
- `--rail` (12rem) is the label column that holds section headings.

Above 1024px each `.section` becomes a rail plus a content column; below it
they stack. `.section--full` opts out so its content spans the whole frame —
that is what the pending panel uses, and what the matrix will use. Everything
hangs off one left edge: prose stops at the measure, the matrix runs on.

Note that media-query `rem` resolves against 16px, not the 18px set on `html`,
so the `64rem` breakpoint fires at 1024px.

## Design

The palette is the parent site's riso zine vocabulary — Fraunces italic,
Caveat, JetBrains Mono, burnt orange — **inverted onto cream stock**, so the
hosted page and the printable sheet carry one palette and one set of accents.
The riso hues are darkened from their dark-ground values to hold on paper.

`--level-3` … `--level-minus-1` in `assets/styles.css` are the level ramp. They
are deliberately unused by the chrome and wait for the matrix, so the frame and
the index cannot drift apart.

The site version is one data source with two call sites: `site.version`
renders as a chip locked up with the wordmark (`_includes/layouts/base.njk`)
and, with `site.versionDate`, as a provenance line in the footer
(`_includes/partials/site-footer.njk`). Bump both together — nothing enforces
the pairing.

## Content

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
