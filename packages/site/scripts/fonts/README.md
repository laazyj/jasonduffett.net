# Vendored fonts

The faces [`../build-og.mjs`](../build-og.mjs) hands to Satori when it renders
the Open Graph card PNGs. Satori needs raw TrueType/OpenType data, and one
static file per weight, so these are static TTF instances rather than the
variable `woff2` the pages load from Google Fonts.

| File                      | Family   | Style  | Weight | Version |
| ------------------------- | -------- | ------ | ------ | ------- |
| `Fraunces-Italic-800.ttf` | Fraunces | italic | 800    | 1.000   |
| `Inter-Regular.ttf`       | Inter    | normal | 400    | 4.001   |
| `Inter-SemiBold.ttf`      | Inter    | normal | 600    | 4.001   |

Upstream projects: [Fraunces](https://github.com/undercasetype/Fraunces) and
[Inter](https://github.com/rsms/inter).

## Provenance

Downloaded from Google Fonts' `css2` endpoint. Requested without a browser
user-agent, it answers with static `truetype` sources instead of `woff2`:

```sh
curl "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@1,800&family=Inter:wght@400;600"
```

Each file is byte-identical to the `.ttf` that response pointed at (Fraunces
`v38`, Inter `v20` on `fonts.gstatic.com`). To refresh, repeat the request,
download each `src` URL and rename it to match the table above.

## Licence

Both families are SIL Open Font License 1.1. See [`OFL.txt`](OFL.txt), which
carries each family's copyright notice. The licence has to accompany the files
because this repository redistributes them. The OG cards only embed rasterised
glyphs, which the OFL permits.
