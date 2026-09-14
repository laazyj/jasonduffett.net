import matrix from "../_data/matrix.js";

/*
  What a sheet file is called, where it lives, and how small is too small.

  Three things need to agree about this and none of them should re-derive it:
  `scripts/build-sheet.mjs` writes the file, `test/sheet.test.js` reads it, and
  `_data/sheet.js` decides whether the download card has anything to point at.
  A second copy of the filename rule — in a shell script, say — is how you get
  a CI job that goes green having asserted nothing.

  It lives here rather than in `_data/sheet.js` because everything in `_data/`
  is an Eleventy data file, and Eleventy resolves those as `mod.default ?? mod`.
  A data file that exports these alongside a default of `null` hands the
  template the module namespace instead — truthy, with no `path` or `size` —
  and the download card renders as a live link to nowhere. Named exports and
  `_data/` do not mix.

  The version comes through `_data/matrix.js`, so the "only door" to the model
  the README describes stays the only door.
*/

export const sheetFilename = `naomi-v${matrix.version}.pdf`;

// static/ is passthrough-copied to the site root, so this is both where a
// sheet is kept and, as /downloads/, where it is served from.
export const sheetDir = new URL("../static/downloads/", import.meta.url);

export const publicPath = `/downloads/${sheetFilename}`;

// Below this it cannot be the whole index — 25 cells of text with four fonts
// embedded. A truncated or stub file is the realistic way a render goes wrong
// while still leaving something on disk.
export const MIN_BYTES = 20_000;
