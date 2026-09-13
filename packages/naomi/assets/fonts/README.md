# Vendored fonts

The four families the index sets in, as local files. The hosted pages fetch the
same faces from Google Fonts (`_includes/partials/head.njk`); the printable
sheet must not, because a render that silently fell back to Georgia would
produce a plausible-looking, wrong PDF and nothing would fail. Only
[`../sheet.css`](../sheet.css) declares them.

| File                    | Family         | Used as     | Weights |
| ----------------------- | -------------- | ----------- | ------- |
| `source-serif-4.woff2`  | Source Serif 4 | `--body`    | 400–700 |
| `fraunces-italic.woff2` | Fraunces       | `--display` | 800–900 |
| `jetbrains-mono.woff2`  | JetBrains Mono | `--mono`    | 400–500 |
| `caveat.woff2`          | Caveat         | `--hand`    | 700     |

One file per family: Google serves all four as **variable** fonts, so a single
face with a weight range covers every weight the index asks for.

## Provenance

Google Fonts' `latin` subset, fetched from the `css2` endpoint using the exact
same family/weight query `head.njk` uses, so the sheet and the hosted pages set
in the same faces. To refresh, request that URL with a browser user-agent and
download the `woff2` each `latin` block points at.

## Coverage

The sheet needs 70 distinct characters, six of them non-ASCII: `©  ·  —  ↓  −`
are all in the `latin` subset. **`→` is not** — Google's `latin` range lists
U+2191 and U+2193 but not U+2192 — so Chrome falls back to a host font for that
one glyph in the corner label, and which font that is depends on the machine
the PDF was generated on.

This does not reach the reader: the fallback glyph is embedded like every other,
so the distributed PDF renders identically everywhere. It only means the same
sheet built on macOS and on Linux differs in that one arrow.

## Licence

All four are SIL Open Font License 1.1 — see [`OFL.txt`](OFL.txt), which
carries each family's copyright notice. The licence has to travel with the
files, and the PDF embeds their glyphs, which the OFL permits.
