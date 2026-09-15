import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  A3_LANDSCAPE,
  MAX_BYTES,
  MIN_BYTES,
  PAGE_TOLERANCE,
  sheetStylesheet,
} from "./sheet-file.mjs";

/*
  What has to be true of a sheet, written once.

  Two things ask: scripts/build-sheet.mjs, before it lets a render replace what
  we distribute, and test/sheet.test.js, of every sheet still in the archive.
  They differ only in what they do about a fault — reject, or fail — so the
  faults themselves are defined here rather than in both.

  That split used to be by hand, and it had already drifted: the font check
  existed only on the test side, so a render that fell back to a system face
  was written into static/downloads/ and committed, and was not noticed until
  the next `npm test`. Precisely what rendering to a scratch file was meant to
  prevent.

  Each check returns a list of faults, empty when there is nothing wrong, so a
  caller can report all of them rather than only the first.

  pdfjs is imported lazily and this module is never imported by _data/, so an
  Eleventy build never loads it.
*/

export async function openPdf(bytes) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise;
}

export async function pageFaults(doc) {
  const faults = [];
  if (doc.numPages !== 1) {
    faults.push(
      `the sheet is ${doc.numPages} pages, and it has to be one. The index has ` +
        "outgrown A3 at the current type scale: lower `font-size` on `html` in " +
        "assets/sheet.css until it fits, or take something out of the model.",
    );
  }
  const [, , width, height] = (await doc.getPage(1)).view;
  if (
    Math.abs(width - A3_LANDSCAPE.width) > PAGE_TOLERANCE ||
    Math.abs(height - A3_LANDSCAPE.height) > PAGE_TOLERANCE
  ) {
    faults.push(
      `the sheet is ${width.toFixed(2)} x ${height.toFixed(2)}pt, not A3 landscape ` +
        `(${A3_LANDSCAPE.width} x ${A3_LANDSCAPE.height}). Check the @page rule in ` +
        "assets/sheet.css.",
    );
  }
  return faults;
}

/*
  The families the sheet asks for, read out of its own @font-face blocks.

  From the stylesheet rather than from assets/fonts/ deliberately: a check
  derived from the directory lowers its own expectations when a file goes
  missing, which is one of the two failures it exists to catch.

  Compared with punctuation and case flattened away, because `"Source Serif 4"`
  is embedded under a name like `AAAAAA+SourceSerif4-Regular`.
*/
const flatten = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const declaredFamilies = () =>
  [
    ...readFileSync(fileURLToPath(sheetStylesheet), "utf8").matchAll(
      /@font-face\s*\{[^}]*?font-family:\s*([^;]+);/g,
    ),
  ].map((m) => m[1].trim().replace(/^["']|["']$/g, ""));

export function fontFaults(bytes) {
  /*
    Read from the PDF's own /FontName entries, which Chrome writes
    uncompressed, rather than through pdfjs — these are Type 3 fonts (Chrome
    flattens a variable instance), and pdfjs reports those only as
    "sans-serif"/"monospace", which would pass whatever had happened.
  */
  const embedded = flatten(
    (bytes.toString("latin1").match(/\/FontName\s*\/[^\s/>\]]+/g) ?? []).join(" "),
  );
  const faults = declaredFamilies()
    .filter((family) => !embedded.includes(flatten(family)))
    .map((family) => `${family} is declared in sheet.css but not embedded in the PDF`);

  /*
    Not by forbidding every fallback: one is expected and documented — "→" is
    in no Google latin subset, so the corner label's arrow comes from a host
    font (assets/fonts/README.md). A generic serif standing in for the body
    text is the failure worth naming.
  */
  const generic = embedded.match(/times|helvetica|georgia|dejavu|liberation/)?.[0];
  if (generic) faults.push(`${generic} is embedded — the body text fell back to a system face`);
  return faults;
}

export function sizeFaults(bytes) {
  if (bytes.length < MIN_BYTES) {
    return [`${bytes.length} bytes is too small to be the whole index`];
  }
  if (bytes.length > MAX_BYTES) {
    return [`${bytes.length} bytes is larger than a sheet has any business being`];
  }
  return [];
}
