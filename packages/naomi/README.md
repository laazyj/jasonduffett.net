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

| Path                  | What it holds                                                           |
| --------------------- | ----------------------------------------------------------------------- |
| `model/naomi.json`    | **The canonical model.** shared with the PDF generator.                 |
| `_data/matrix.js`     | The checked view of it — the only door templates see the model through. |
| `_data/site.json`     | Site chrome: title, description, licence, links, article, PDF.          |
| `_includes/layouts/`  | The base layout: masthead, page slot, footer, consent banner.           |
| `_includes/partials/` | Head, footer, analytics, consent banner, and the matrix.                |
| `content/index.njk`   | The single page — markers, index, how to read it, background, links.    |
| `assets/styles.css`   | The frame's styling. Shipped verbatim; no build step.                   |
| `assets/matrix.css`   | The index's styling, including the density ladder.                      |
| `assets/matrix.js`    | The index's behaviour. The package's only browser script.               |
| `static/`             | Files served from the site root: `favicon.svg`, the IndexNow key.       |

## The data source

`model/naomi.json` is the **canonical model** — pillars, levels, and the
behaviours in every cell — and is shared with the PDF generator. It is
never edited to suit the web view.

It sits outside `_data/` deliberately: Eleventy would otherwise also expose it
as a global, and templates could reach the raw model around the checks below.
`_data/matrix.js` is the only door, and re-exports the version, date,
definition and markers as well as the matrix itself.

That file derives what the page needs and the model does not itself express:
levels reversed so the matrix reads downward, the level description split into
a claim and a gloss, cells re-keyed `<level>.<pillar>`, a real minus for
negative ordinals, a short label per pillar for the narrowest width, and the
level's colour token, which the row then carries inline.

It also **asserts**, so a model change the page cannot render fails the build
rather than shipping a blank cell or a colourless row:

- every field it forwards exists and is non-empty;
- every pillar has a short label in `SHORT_LABELS`;
- every level id has a colour token in `ACCENT_TOKENS`;
- every level x pillar has a cell, and every cell has a behaviour;
- every level description is two sentences.

Add a pillar and the build stops with the pillar's id and what to do about it.

The model carries **no per-cell headline**, so the first behaviour is the
cell's label — its visible text at the middle width and its click target
everywhere. That decision lives in `_data/matrix.js`, not the template. A
headline field in the model would let a fourth step back into the ladder,
between "first behaviour" and "colour only".

Version and date come from `naomi.model`, so they cannot drift from the content
they describe.

## The matrix

Density is decided by media queries in `assets/matrix.css`, not by JavaScript:

| Width       | A cell shows             |
| ----------- | ------------------------ |
| `>= 1200px` | all three behaviours     |
| `< 1200px`  | the first behaviour only |
| `< 1000px`  | a coloured block only    |

The ladder only ever subtracts, and is gated on `(scripting: enabled)` — it
hides only what expanding can bring back, so without a script it does not apply
and every cell renders in full. Print gets everything for the same reason.
Thresholds are in `px`: media-query `rem` resolves against 16px rather than the
18px root, so `rem` there would not mean what it means elsewhere here.

`assets/matrix.js` is interaction only — expanding a cell, a level or a pillar,
keyboard grid navigation, and `#cell-<pillar>-<level>` deep links.

The remedial row's band extends past the table by `--m-bleed`. Its rail text
sits flush left to line up with every other row, which on an ink ground put the
words hard against the edge of the black, so the band grows rather than the
text moving.

### Safari

Four things here are workarounds for Safari specifically, each commented in
place. Grep for `SAFARI:` before simplifying any of them — every one renders
correctly in headless WebKit and incorrectly in Safari itself, so a local check
will not catch a regression:

- `border-collapse: separate`, not `collapse`. Collapsed borders are painted as
  one shared table-level layer that Safari fails to invalidate on hover,
  dropping the rule under the header in segments.
- The remedial band is positioned boxes, not `box-shadow` on the `<tr>`. Safari
  does not reliably paint shadows on table boxes.
- Density is CSS, not a class set from retained `MediaQueryList` objects. A
  `MediaQueryList` with no strong reference can be collected in Safari, taking
  its listener with it.
- `text-size-adjust: 100%` on `html` in [`assets/styles.css`](assets/styles.css),
  the one of the four that is not in `matrix.css`. iOS boosts a text block's
  font size from the block's width; opening a pillar sets `colSpan` on a cell,
  and the boost computed at that width outlives the cell narrowing again. iOS
  and Chrome Android only — desktop Safari does not autosize either.

## Design

The palette is the parent site's riso zine vocabulary — Fraunces italic,
Caveat, JetBrains Mono, burnt orange — **inverted onto cream stock**, so the
hosted page and the printable sheet carry one palette and one set of accents.
The riso hues are darkened from their dark-ground values to hold on paper.

`--level-3` … `--level-minus-1` in `assets/styles.css` are the level ramp, used
by `assets/matrix.css` and by nothing in the chrome. The mapping from level id
to token is five hand-written rules; `_data/matrix.js` asserts every id in the
model has one.

The site version is the model's version. `naomi.model.version` renders as a
chip locked up with the wordmark (`_includes/layouts/base.njk`) and, with
`naomi.model.date`, as a provenance line in the footer
(`_includes/partials/site-footer.njk`). Both come from one object in the
canonical file, so they cannot be bumped out of step.

## Content

The PDF is not published yet. `site.pdf` is `null`, which renders the download
card in a disabled state. To publish it, drop the file in `assets/` and set:

```json
"pdf": { "path": "/assets/naomi.pdf", "label": "The printable index", "size": "1.2 MB" }
```

The index content is licensed **CC BY 4.0**, matching the apex site. The pages
carry `<link rel="license">`, a `copyright` meta naming the licence, and
`tdm-reservation: 0` with a `tdm-policy` pointing at the apex site's licence
policy — so text and data mining, AI training included, is permitted with
attribution. The terms live in `site.json` as `defaultLicense`, `licenseName`
and `licensePolicyUrl`, the same three keys the apex site uses.

## Analytics

Set `NAOMI_GA_MEASUREMENT_ID` at build time to enable Google Analytics 4 and the
cookie consent banner — a separate GA4 property from the apex site and from
Clara's subsite. Leave it unset to ship without any analytics. See
[`.env.example`](.env.example).
