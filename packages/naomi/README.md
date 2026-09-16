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

| Path                       | What it holds                                                             |
| -------------------------- | ------------------------------------------------------------------------- |
| `model/naomi.json`         | **The canonical model.** Shared with the sheet.                           |
| `_data/matrix.js`          | The checked view of it — the only door templates see the model through.   |
| `_data/sheet.js`           | The generated sheet, as the download card sees it. Derived, not declared. |
| `_data/site.json`          | Site chrome: title, description, licence, links, article.                 |
| `_includes/layouts/`       | `base.njk` for the hosted pages, `sheet.njk` for the printable one.       |
| `_includes/partials/`      | Head, masthead, provenance meta, footer, analytics, consent, the matrix.  |
| `content/index.njk`        | The single page — intro, index, how to read it, markers, background.      |
| `content/sheet.njk`        | The printable sheet: masthead, the index in full, a provenance footer.    |
| `assets/styles.css`        | The frame's styling. Shipped verbatim; no build step.                     |
| `assets/matrix.css`        | The index's styling, including the density ladder.                        |
| `assets/sheet.css`         | The sheet's page geometry and type scale. Nothing else.                   |
| `assets/matrix.js`         | The index's behaviour. The package's only browser script.                 |
| `assets/fonts/`            | The four families, vendored so the sheet needs no network.                |
| `scripts/build-sheet.mjs`  | Prints the sheet to PDF with the Chrome already on the machine.           |
| `scripts/sheet-checks.mjs` | What has to be true of a sheet. The generator and the test share it.      |
| `test/sheet.test.js`       | What stops a broken sheet being distributed.                              |
| `static/`                  | Served from the site root: `favicon.svg`, the IndexNow key, `downloads/`. |

## The data source

`model/naomi.json` is the **canonical model** — pillars, levels, the
behaviours in every cell, and how finished the model claims to be — and is
shared with the PDF generator. It is never edited to suit the web view.

`model.status` is the pre-release caveat: `label` for the chip, `note` for the
sentence over the index. It is in the model rather than in `site.json` because
it is a claim about the model, not about the site — a printed sheet handed
round a room needs it at least as much as the page does, and the two must not
be able to disagree about it. Editorial copy about the _site_ still belongs in
`site.json`, as `ledeNote` and `article.note` do.

It sits outside `_data/` deliberately: Eleventy would otherwise also expose it
as a global, and templates could reach the raw model around the checks below.
`_data/matrix.js` is the only door, and re-exports the version, date, status,
definition, spine and markers as well as the matrix itself.

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
- every level description is two sentences;
- `model.status` carries a `label` and a `note`, so a version bump cannot drop
  the pre-release caveat and ship the model as though it were finished.

Add a pillar and the build stops with the pillar's id and what to do about it.

The model carries **no per-cell headline**, and nothing promotes one behaviour
over the others: `_data/matrix.js` hands the template a flat list, the template
renders them alike, and the whole cell — not any one behaviour — is the click
target. What the middle width shows is the first behaviour only, which is the
stylesheet's decision about room, not a claim that it is the important one. A
headline field in the model would let a fourth step into the ladder, between
"first behaviour" and "colour only".

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

## The printable sheet

`/sheet/` is the whole index on one A3 landscape page — masthead, all 25 cells
at full content, a provenance footer. It is `noindex` and out of the sitemap,
because it is a render target rather than a destination, though it doubles as a
browser print view.

It is **not a second implementation**. `styles.css` and `matrix.css` do the
work and `partials/matrix.njk` is the same partial the home page renders;
`assets/sheet.css` sets page geometry and the type scale that geometry needs,
and nothing else. Every size in the other two files is in `rem`, so the root
`font-size` is the single lever that fits 25 cells to a page.

Three details there are load-bearing and look like mistakes:

- The page box is `1587px 1123px`, not `A3 landscape`. Chrome's PDF MediaBox
  comes out a fraction wider than the integer pixel width it lays out at, and
  nothing in CSS can paint past the layout viewport — so `A3 landscape` leaves
  a 2pt hairline of unpainted white down the right edge of a full-bleed sheet.
  A whole number of pixels leaves none, and is A3 to within a quarter of a
  millimetre.
- The density ladder in `matrix.css` is scoped away from `body.sheet`. Its
  `scripting: enabled` gate reports what the browser allows, not whether the
  document loaded `matrix.js` — and the sheet loads none.
- Every wide-layout query in `styles.css` names `print` alongside its width.
  A print media query cannot be told how wide the paper is, and without it the
  masthead stacks and spends 137pt of an 842pt page. The mechanism is
  documented above those queries; do not tidy the `print` away.

```sh
npm run naomi:pdf     # writes static/downloads/naomi-v<version>.pdf
npm test              # asserts it is one A3 page and nothing is missing
```

**Chrome has to be on the machine.** Nothing is bundled: `--print-to-pdf`
honours the `@page` size and paints backgrounds, which is all the sheet needs,
so there is no browser in `devDependencies` and no DevTools protocol code.
`scripts/build-sheet.mjs` looks at `CHROME_PATH`, then the usual names on
`PATH`, then the macOS app bundles, and says which it tried if it finds none.

Released sheets are **committed**. The CloudFront bucket deployment prunes, so
anything not in `dist` is deleted on deploy — a sheet lives in the repo, is
passthrough-copied forward by every build, and a link printed on paper keeps
resolving after the model has moved on.

That is a promise about _released_ versions. Renumbering a pre-release — v0.1.0
to v0.1, say — replaces its sheet rather than archiving it, and the old URL
stops resolving.

### Testing it

`test/sheet.test.js` checks two different things, because we distribute two
different things:

- **Every sheet in `static/downloads/`** gets the file-level invariants — one
  A3 landscape page, the four vendored families embedded, a plausible size.
  Older versions are still served, so they are still worth checking.
- **The sheet for the current version** also gets the content assertions: all
  75 behaviours, every pillar name and promise, every level name, description
  and entitlement, the provenance line, and no `undefined` leaking from a
  renamed model field.

The single-page assertion is the one that matters: content that outgrows A3
fails rather than shipping with a level stranded on page two.

Once a sheet has been published, every later version owes one: the download
card is derived from the model's version, so bumping it without regenerating
ships the site with its only download silently gone. That is read off
`sheets.json` rather than `process.env.CI`, so it fails in the same place
locally as on a runner — at the bump, not at the push.

### One page is enforced where it is decided

`scripts/build-sheet.mjs` renders to a scratch file and only moves it into
place once the result passes every check in `scripts/sheet-checks.mjs` — one
A3 page, the four declared families embedded, a plausible size. A sheet that
fails never reaches `static/downloads/` at all, so there is nothing for a later
check to catch.

The test asks those same questions of every sheet in the archive. That is not
duplication: the generator gates what may be written, the test gates what is
still distributed. They share the checks so they cannot drift — an earlier
split by hand had already lost the font check from the generator's side, which
meant a render that fell back to a system face was written and committed and
only noticed on the next `npm test`.

That matters because **page fit is not only a function of content**. The lever
is `font-size` on `html` in [`assets/sheet.css`](assets/sheet.css), and a
change there — or to `matrix.css`, or to a font — moves nothing in the model. A
digest of the content cannot see it; only rendering can.

### Staleness, and `sheets.json`

Checking that every string in the model appears in the PDF is blind to two
things: a behaviour **removed** from the model (the sheet keeps showing it, and
every remaining string is still present) and a behaviour **moved** between
cells (every string is still somewhere). `sheets.json` closes both with a
digest of the built page's text, in the order the page says it.

| Field     | What it is                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content` | Digest of the built page's text. **Enforced.**                                                                                                    |
| `render`  | Digest of the page and the assets beside it. Provenance only — what matters about a styling change is fit, and that is enforced in the generator. |
| `sha256`  | The PDF itself, tying the record to the artefact so a sheet replaced by hand is caught                                                            |
| `chrome`  | The one input that is not in the tree                                                                                                             |

**CI needs no Chrome and renders nothing.** It used to render a sheet from the
current model to ask whether the next one would still fit; the generator
refusing to write a sheet that does not fit answers that question at the point
it arises, on the file that will actually be published.

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
chip locked up with the wordmark (`_includes/partials/masthead.njk`) and, with
`naomi.model.date`, as a provenance line in the footer
(`_includes/partials/site-footer.njk`). Both come from one object in the
canonical file, so they cannot be bumped out of step.

`naomi.model.status.label` renders as a second chip beside it, **filled** where
the version chip is outlined: the version is a fact and the status is a claim
about it. Both chips are chrome and travel on every page, because where the
model is does not depend on which page you are reading. Which part of it is
unfinished does, so `status.note` renders once, as the aside over the hosted
index — the cells being the part still under test. The masthead is shared with
the printable sheet, so the chip reaches it; the note does not.

## Content

The download card is derived, not declared. `_data/sheet.js` looks for
`static/downloads/naomi-v<version>.pdf` — the version being the model's — and
the card renders its disabled state when there is no sheet for this version
yet. There is no field to bump and no file size to keep in step; publishing a
sheet is `npm run naomi:pdf` and committing the result.

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
