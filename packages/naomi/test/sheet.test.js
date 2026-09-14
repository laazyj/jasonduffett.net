import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { describe, expect, it, beforeAll } from "vitest";

import matrix from "../_data/matrix.js";
import site from "../_data/site.json" with { type: "json" };
import { MIN_BYTES, sheetDir, sheetFilename } from "../scripts/sheet-file.mjs";

/*
  The sheet is the one thing here distributed as a binary and read offline, so
  it is the one thing a bad build cannot be walked back. These assertions are
  what stand between a content edit and a PDF with a level missing off the
  bottom of the page.

  Two scopes, because we distribute two different things:

  - Every sheet in the archive gets the file-level invariants. Older versions
    are still served (the bucket deployment prunes, so they stay reachable
    only by being committed), and something we still hand out is something
    still worth checking.
  - The sheet for the *current* version also gets the content assertions,
    because that is the only one the model can still speak for.

  NAOMI_SHEET_DIR points this somewhere else — CI renders from the current
  model into a temp dir to ask whether the *next* sheet would still fit,
  before any version bump.
*/

const dir = process.env.NAOMI_SHEET_DIR ?? fileURLToPath(sheetDir);
const currentPath = join(dir, sheetFilename);
const current = statSync(currentPath, { throwIfNoEntry: false })?.isFile() ?? false;

/*
  A missing sheet is normally fine — a fresh clone has none until someone runs
  `npm run naomi:pdf`, and the download card renders its disabled state.

  It is not fine when someone has pointed us at one, or on CI. An explicit
  NAOMI_SHEET_DIR means a sheet was just rendered and is waiting to be checked;
  a CI run means this version is on its way to being published. Skipping in
  either case is how a job goes green having asserted nothing at all, which is
  worse than having no test.
*/
const required = Boolean(process.env.NAOMI_SHEET_DIR || process.env.CI);

const archive = (() => {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".pdf"))
      .sort();
  } catch {
    return [];
  }
})();

// A3 landscape. Not 1190.55 x 841.89: the page box is declared in whole CSS
// pixels (see assets/sheet.css), which lands a fraction under A3 and is the
// only way to get a full-bleed sheet with no unpainted edge.
const A3_LANDSCAPE = { width: 1189.92, height: 841.92 };
const TOLERANCE = 1.5;

const open = async (path) => {
  const bytes = readFileSync(path);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise;
  return { bytes, doc };
};

/*
  A renderer breaks a word at a hyphen and the hyphen ends the line, so
  "false-positive" comes back as "false-" then "positive". These are presence
  assertions rather than proofreading, so flatten hyphens and whitespace away
  on both sides and the question never arises. (Order matters: collapsing
  whitespace first would leave "false positive" and never match.)
*/
const flat = (s) =>
  s
    .normalize("NFC")
    .replace(/[\u00AD\u200B]/g, "") // soft hyphen, zero-width space
    .replace(/-\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();

it("has a sheet to check", () => {
  // Guards the case where everything below quietly skips: a wrong
  // NAOMI_SHEET_DIR, or a version bumped without regenerating.
  if (required && !current) {
    throw new Error(
      `no sheet at ${currentPath}. ` +
        (process.env.NAOMI_SHEET_DIR
          ? "NAOMI_SHEET_DIR is set, so one was expected there."
          : `this is CI, so v${matrix.version} must ship with its sheet — run \`npm run naomi:pdf\`.`),
    );
  }
  expect(required ? current : true).toBe(true);
});

/* ---- everything we still hand out ------------------------------------ */

describe.each(archive)("%s", (filename) => {
  let bytes;
  let doc;

  beforeAll(async () => {
    ({ bytes, doc } = await open(join(dir, filename)));
  });

  it("is a single page", () => {
    // The whole point of the artefact. Content that outgrows A3 fails here
    // rather than shipping with a level stranded on page two; the lever is
    // the root font-size in assets/sheet.css.
    expect(doc.numPages).toBe(1);
  });

  it("is A3 landscape", async () => {
    const [, , width, height] = (await doc.getPage(1)).view;
    expect(Math.abs(width - A3_LANDSCAPE.width)).toBeLessThan(TOLERANCE);
    expect(Math.abs(height - A3_LANDSCAPE.height)).toBeLessThan(TOLERANCE);
  });

  it("embeds the fonts it sets in", () => {
    /*
      The failure this guards is silent: a render that could not reach the
      vendored woff2 falls back to a system face and the PDF still looks
      entirely plausible.

      Read from the PDF's own /FontName entries, which Chrome writes
      uncompressed, rather than through pdfjs — these are Type 3 fonts (Chrome
      flattens a variable instance), and pdfjs reports those only as
      "sans-serif"/"monospace", which would pass whatever had happened.
    */
    const names = (bytes.toString("latin1").match(/\/FontName\s*\/[^\s/>\]]+/g) ?? []).join(" ");
    for (const family of ["SourceSerif4", "Fraunces", "JetBrainsMono", "Caveat"]) {
      expect(names).toContain(family);
    }
    // Positively, not by forbidding every fallback: one is expected and
    // documented — "→" is in no Google latin subset, so the corner label's
    // arrow comes from a host font (assets/fonts/README.md). A generic serif
    // standing in for the body text is the failure worth naming.
    expect(names).not.toMatch(/Times|Helvetica|Georgia|DejaVu|Liberation/);
  });

  it("is a plausible size for what it carries", () => {
    // No %PDF- check: getDocument in beforeAll cannot resolve on anything
    // else, so reaching this at all has already proved it.
    expect(bytes.length).toBeGreaterThan(MIN_BYTES);
    expect(bytes.length).toBeLessThan(5_000_000);
  });
});

/* ---- and what the model can still speak for -------------------------- */

describe.runIf(current)(`${sheetFilename} content`, () => {
  let text;

  beforeAll(async () => {
    const { doc } = await open(currentPath);
    const content = await (await doc.getPage(1)).getTextContent();
    text = flat(content.items.map((i) => i.str + (i.hasEOL ? "\n" : "")).join(""));
  });

  it("carries every behaviour in every cell", () => {
    const missing = [];
    for (const level of matrix.levels) {
      for (const pillar of matrix.pillars) {
        for (const behaviour of matrix.cells[`${level.id}.${pillar.id}`]) {
          if (!text.includes(flat(behaviour))) missing.push(`${pillar.id}/${level.id}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("carries every pillar and every level in full", () => {
    const want = [];
    for (const p of matrix.pillars) want.push([p.id, p.name], [`${p.id} promise`, p.promise]);
    for (const l of matrix.levels) {
      want.push(
        [`${l.id} assurance`, l.assurance],
        [`${l.id} description`, `${l.lead} ${l.rest}`],
        [`${l.id} entitlement`, l.entitlement],
      );
    }
    expect(want.filter(([, value]) => !text.includes(flat(value))).map(([what]) => what)).toEqual(
      [],
    );
  });

  it("carries the framing it is meant to be read with", () => {
    expect(text).toContain(flat(matrix.definition));
    expect(text).toContain(flat(site.ledeNote));
    expect(text).toContain(flat(matrix.spine.assessmentQuestion));
  });

  it("says who owns it, under what licence, and which version it is", () => {
    for (const claim of [
      site.author.name,
      site.licenseName,
      `v${matrix.version}`,
      matrix.date,
      new URL(site.url).host,
    ]) {
      expect(text).toContain(flat(claim));
    }
  });

  it("renders no placeholder for a field that went missing", () => {
    // A renamed model field forwarded as `undefined` reads as a plausible
    // word on a printed page. _data/matrix.js is what stops it; this is what
    // notices if it ever does not.
    expect(text).not.toMatch(/\b(undefined|NaN|\[object Object\])\b/);
  });
});
