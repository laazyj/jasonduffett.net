import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { describe, expect, it, beforeAll } from "vitest";

import matrix from "../_data/matrix.js";
import site from "../_data/site.json" with { type: "json" };
import {
  A3_LANDSCAPE,
  MIN_BYTES,
  PAGE_TOLERANCE,
  sheetDir,
  sheetFilename,
} from "../scripts/sheet-file.mjs";
import { contentDigest, readManifest, sha256 } from "../scripts/sheet-manifest.mjs";

/*
  The sheet is the one thing here distributed as a binary and read offline, so
  it is the one thing a bad build cannot be walked back.

  Two scopes, because we distribute two different things:

  - Every sheet in static/downloads/ gets the file-level invariants. Older
    versions stay reachable only by being committed — the bucket deployment
    prunes — so anything we still hand out is worth still checking.
  - The sheet for the *current* version also gets the content assertions and
    the digest, because it is the only one the model can still speak for.

  What is NOT here: a check that a sheet fits one page before it is written.
  scripts/build-sheet.mjs renders to a scratch file and refuses to move it into
  place unless it is a single A3 page, so a sheet that does not fit never
  reaches this directory in the first place.
*/

const dir = fileURLToPath(sheetDir);
const currentPath = join(dir, sheetFilename);
const current = statSync(currentPath, { throwIfNoEntry: false })?.isFile() ?? false;
const builtPage = fileURLToPath(new URL("../dist/sheet/index.html", import.meta.url));

/*
  A missing sheet is normally fine — a fresh clone has none until someone runs
  `npm run naomi:pdf`, and the download card renders its disabled state. It is
  not fine on CI, where this version is on its way to being published:
  otherwise a version bumped without regenerating ships the site with its only
  download silently gone, and every test below skips green.
*/
const required = Boolean(process.env.CI);

const archive = (() => {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".pdf"))
      .sort();
  } catch {
    return [];
  }
})();

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
  if (required && !current) {
    throw new Error(
      `no sheet at ${currentPath}. This is CI, so v${matrix.version} must ship ` +
        "with its sheet — run `npm run naomi:pdf` and commit the result.",
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
    expect(doc.numPages).toBe(1);
  });

  it("is A3 landscape", async () => {
    const [, , width, height] = (await doc.getPage(1)).view;
    expect(Math.abs(width - A3_LANDSCAPE.width)).toBeLessThan(PAGE_TOLERANCE);
    expect(Math.abs(height - A3_LANDSCAPE.height)).toBeLessThan(PAGE_TOLERANCE);
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

/* ---- is the one we ship still the one the model describes? ------------ */

describe.runIf(current)("sheets.json", () => {
  const entry = readManifest()[sheetFilename];

  it("records the sheet we ship", () => {
    expect(entry, `no entry for ${sheetFilename} — run \`npm run naomi:pdf\``).toBeDefined();
    // Ties the record to the artefact: without this the manifest could
    // describe a sheet that was replaced by hand.
    expect(entry.sha256).toBe(sha256(readFileSync(currentPath)));
  });

  it("was generated from the page as it now builds", () => {
    /*
      The gap the content assertions cannot see. They check every string the
      model carries is somewhere in the PDF, which stays true when a behaviour
      is deleted from the model or moved to another cell. The digest is of the
      built page's text, in order, so both show up — as does anything else the
      sheet says, without a list of fields to keep in step.
    */
    expect(
      entry.content,
      "the committed sheet predates the current page — run `npm run naomi:pdf`",
    ).toBe(contentDigest(builtPage));
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
