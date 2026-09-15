import { statSync } from "node:fs";

import { publicPath, readable, sheetDir, sheetFilename } from "../scripts/sheet-file.mjs";

/*
  The printable sheet, as the download card sees it.

  Derived, not declared. The filename carries the model's version, so the card
  can only ever point at the sheet for the version the page is rendering —
  there is no field to forget to bump and no hand-typed size to go stale.
  `site.json` used to carry a `pdf` object for this and no longer does.

  A default export and nothing else, deliberately: Eleventy resolves an ESM
  data file as `mod.default ?? mod`, so a named export alongside a `null`
  default would hand the template the module namespace — truthy, with no
  `path` — and the card would render as a live link to nowhere. The shared
  facts live in scripts/sheet-file.mjs for exactly that reason.
*/

/*
  `throwIfNoEntry: false` rather than a try/catch: absent is the expected case
  and wants `undefined`, but EACCES or a broken symlink is a real problem and
  should still throw rather than being quietly reported as "no sheet yet".
*/
const stats = statSync(new URL(sheetFilename, sheetDir), { throwIfNoEntry: false });

/*
  Null when there is no plausible sheet for this version, which
  `content/index.njk` renders as the card's disabled state. That is the honest
  thing for it to do: a fresh clone builds before anyone has run
  `npm run naomi:pdf`, and a version bump lands before its sheet does.

  Presence is the whole test. The generator renders to a scratch name and
  renames it into place, which is atomic within the directory, so a
  half-written file cannot exist at this path — what a plausible sheet weighs
  is the test's business, not the card's.
*/
export default stats ? { path: publicPath, size: readable(stats.size) } : null;
