import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sheetDir } from "./sheet-file.mjs";

/*
  What each released sheet was generated from, so a committed PDF cannot
  quietly stop describing the model it claims to.

  The content assertions in test/sheet.test.js check that every string the
  model carries appears in the PDF. That is blind to two things a printed
  sheet can still get wrong: a behaviour *removed* from the model (the sheet
  keeps showing it, and every remaining string is still present) and a
  behaviour *moved* between cells (every string is still somewhere). A digest
  of what the page says, in the order it says it, catches both.

  Two digests, and only one of them is a check:

  - `content` is the text of the built page. Enforced by the test: a sheet
    whose content digest does not match the current build is misstating the
    model, which is the whole problem.

  - `render` is the page and the assets beside it, bytes and all. Recorded as
    provenance, not asserted. What actually matters about a styling change is
    whether the sheet still fits one page, and that is enforced where it
    belongs — scripts/build-sheet.mjs will not write a sheet that does not.
*/

const packageDir = resolve(fileURLToPath(sheetDir), "..", "..");
const manifestPath = join(packageDir, "sheets.json");

export const manifestName = basename(manifestPath);

export const sha256 = (input) => createHash("sha256").update(input).digest("hex");

/*
  The text of the built page, which is the honest version of "everything the
  sheet says". Derived rather than listed: an earlier hand-written list of the
  model fields the sheet prints had already missed `site.fullTitle` on the day
  it was written, which is what a second model of the template always does.

  Taken from the HTML rather than from the PDF because it has to be exact —
  extracting text from a PDF brings its own wrinkles (a word broken at a
  hyphen, ligatures, spacing) that a digest cannot forgive. The built page is
  the same input Chrome renders from, so it answers the same question without
  them.

  The copyright year is normalised away. It is not a property of the model,
  and leaving it in would mark every sheet stale each January.
*/
export function sheetText(sheetHtmlPath) {
  const html = readFileSync(sheetHtmlPath, "utf8");
  return html
    .slice(html.indexOf("<body"))
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/(&copy;|©)\s*\d{4}/g, "$1 YYYY")
    .replace(/\s+/g, " ")
    .trim();
}

export const contentDigest = (sheetHtmlPath) => sha256(sheetText(sheetHtmlPath));

/*
  The page and everything the build put beside it. A walk of the output rather
  than a scrape of the page's own `href`s and `url()`s: the scraper had to tell
  external URLs, fragments and directories apart from files, and it survived
  the `url("data:image/svg+xml;utf8,<svg …>")` in styles.css only because that
  URI happens to end in `>` rather than a dot-extension. Rewrite that SVG and
  it would have started trying to read a data URI as a path.

  Scripts are excluded: the sheet deliberately loads none, so assets/matrix.js
  changing says nothing about how the sheet looks.
*/
export function renderDigest(sheetHtmlPath, assetsDir) {
  const files = [sheetHtmlPath];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (!path.endsWith(".js")) files.push(path);
    }
  };
  walk(assetsDir);

  // Sorted, and keyed by path relative to the package, so the digest depends
  // on neither the order the walk found them in nor where the repo sits.
  const digest = createHash("sha256");
  for (const path of files.sort()) {
    digest.update(relative(packageDir, path));
    digest.update(readFileSync(path));
  }
  return digest.digest("hex");
}

export function readManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return {};
  }
}

// Key-sorted so the file reads as an ordered list of releases and a new entry
// lands where it belongs rather than at the end.
export function writeManifest(filename, entry) {
  const manifest = { ...readManifest(), [filename]: entry };
  const ordered = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(manifestPath, JSON.stringify(ordered, null, 2) + "\n");
}
