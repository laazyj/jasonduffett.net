import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, afterAll, beforeAll } from "vitest";

import matrix from "../_data/matrix.js";
import site from "../_data/site.json" with { type: "json" };
import { builtSheetPage, sheetDir, sheetFilename } from "../scripts/sheet-file.mjs";
import { fontFaults, openPdf, pageFaults, sizeFaults } from "../scripts/sheet-checks.mjs";
import { contentDigest, readManifest, sha256 } from "../scripts/sheet-manifest.mjs";

/*
  The sheet is the one thing here distributed as a binary and read offline, so
  it is the one thing a bad build cannot be walked back.

  Two scopes, because we distribute two different things:

  - Every sheet in static/downloads/ gets the file-level checks. Older versions
    stay reachable only by being committed — the bucket deployment prunes — so
    anything we still hand out is worth still checking.
  - The sheet for the current version also gets the content assertions and the
    manifest digest, because it is the only one the model can still speak for.

  The file-level checks are sheet-checks.mjs, shared with the generator, which
  refuses to publish a render that fails them. That is not duplication: the
  generator gates what may be written, this gates what is still distributed.
*/

const dir = fileURLToPath(sheetDir);
const currentPath = join(dir, sheetFilename);
const current = statSync(currentPath, { throwIfNoEntry: false })?.isFile() ?? false;

const archive = readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".pdf"))
  .map((e) => e.name)
  .sort();

const manifest = readManifest();

/*
  Once this project has published a sheet, every later version owes one: the
  download card is derived from the model's version, so bumping it without
  regenerating ships the site with its only download silently gone.

  Derived from the record rather than from `process.env.CI`, which was the
  wrong signal in two directions — it let a local `npm test` pass on a state
  that would fail on push, and its stated excuse ("a fresh clone has no
  sheet") stopped being true the moment sheets were committed to git.
*/
const required = Object.keys(manifest).length > 0;

// One parse per file however many blocks ask for it.
const opened = new Map();
const open = (path) => {
  if (!opened.has(path)) {
    const bytes = readFileSync(path);
    opened.set(
      path,
      openPdf(bytes).then((doc) => ({ bytes, doc })),
    );
  }
  return opened.get(path);
};

// Releases each document's cached pages and font data rather than holding
// every archived sheet's in memory until the file ends. `cleanup`, not
// `destroy`: in pdfjs the document proxy has the former, the loading task the
// latter, and the task is not what openPdf hands back.
afterAll(async () => {
  for (const pending of opened.values()) (await pending).doc.cleanup();
});

/*
  A renderer breaks a word at a hyphen and the hyphen ends the line, so
  "false-positive" comes back as "false-" then "positive". These are presence
  assertions rather than proofreading, so flatten hyphens and whitespace away
  on both sides and the question never arises. (Order matters: collapsing
  whitespace first would leave "false positive" and never match.)
*/
const flat = (s) => s.normalize("NFC").replace(/-\s*/g, "").replace(/\s+/g, " ").trim();

it.runIf(required)("ships a sheet for the current version", () => {
  expect(
    current,
    `no sheet at ${currentPath} — run \`npm run naomi:pdf\` and commit the result`,
  ).toBe(true);
});

/* ---- everything we still hand out ------------------------------------ */

describe.each(archive)("%s", (filename) => {
  let bytes;
  let doc;

  beforeAll(async () => {
    ({ bytes, doc } = await open(join(dir, filename)));
  });

  it("is a single A3 landscape page", async () => {
    // The whole point of the artefact. Content that outgrows A3 fails here
    // rather than being handed to a reader with a level stranded on page two.
    expect(await pageFaults(doc)).toEqual([]);
  });

  it("embeds the fonts it sets in", () => {
    // Silent when it goes wrong: a render that could not reach the vendored
    // woff2 falls back to a system face and still looks entirely plausible.
    expect(fontFaults(bytes)).toEqual([]);
  });

  it("is a plausible size for what it carries", () => {
    expect(sizeFaults(bytes)).toEqual([]);
  });
});

/* ---- and the one the model can still speak for ------------------------ */

describe.runIf(current)(`${sheetFilename} — against the current model`, () => {
  const entry = manifest[sheetFilename];
  let text;

  beforeAll(async () => {
    const { doc } = await open(currentPath);
    const content = await (await doc.getPage(1)).getTextContent();
    text = flat(content.items.map((i) => i.str + (i.hasEOL ? "\n" : "")).join(""));
  });

  it("is the sheet sheets.json describes", () => {
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
    ).toBe(contentDigest(fileURLToPath(builtSheetPage)));
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
