import matrix from "../_data/matrix.js";

/*
  The facts about a sheet that several things have to agree on: what it is
  called, where it lives, what page it should be, and what counts as a
  plausible size.

  Three consumers need these and none of them should re-derive them:
  scripts/build-sheet.mjs writes a sheet, test/sheet.test.js reads one, and
  _data/sheet.js decides whether the download card has anything to point at.
  A second copy of the filename rule — in a shell script, say — is how you get
  a CI job that goes green having asserted nothing.

  Deliberately light. `_data/sheet.js` imports this on every Eleventy build,
  so nothing here may pull in crypto, pdfjs or a directory walk; those live in
  sheet-manifest.mjs and sheet-checks.mjs, which the data file never touches.

  The version comes through `_data/matrix.js`, so the "only door" to the model
  the README describes stays the only door.
*/

const packageDir = new URL("../", import.meta.url);

export const sheetFilename = `naomi-v${matrix.version}.pdf`;

// static/ is passthrough-copied to the site root, so this is both where a
// sheet is kept and, as /downloads/, where it is served from.
export const sheetDir = new URL("static/downloads/", packageDir);

export const publicPath = `/downloads/${sheetFilename}`;

// The page the sheet is printed from. Named here because the generator digests
// it at publish time and the test digests it again to compare — if those two
// ever named different files, the mismatch would read as a stale sheet.
export const builtSheetPage = new URL("dist/sheet/index.html", packageDir);

export const builtAssetsDir = new URL("dist/assets/", packageDir);

// The stylesheet that declares the sheet's @font-face families. Read rather
// than listed, so swapping a family cannot leave a check asserting the
// departed one — and read from what the page *asks for*, not from the fonts
// directory, so a missing file is a fault rather than a lowered expectation.
export const sheetStylesheet = new URL("assets/sheet.css", packageDir);

/*
  A3 landscape as Chrome actually writes it. Not 1190.55 x 841.89: the page
  box is declared in whole CSS pixels (assets/sheet.css), which lands a
  fraction under A3 and is the only way to get a full-bleed sheet with no
  unpainted edge.
*/
export const A3_LANDSCAPE = { width: 1189.92, height: 841.92 };
export const PAGE_TOLERANCE = 1.5;

/*
  What a whole sheet weighs, roughly. Below the floor it cannot be 25 cells of
  text with four fonts embedded; above the ceiling something has gone wrong in
  a way worth looking at. One policy, stated as a pair.
*/
export const MIN_BYTES = 20_000;
export const MAX_BYTES = 5_000_000;

// The card and the generator's log should not disagree about how big the same
// file is. A sheet is a few hundred KB and the ceiling above keeps it there,
// so kilobytes is the only unit needed.
export const readable = (bytes) => `${Math.round(bytes / 1024)} KB`;
