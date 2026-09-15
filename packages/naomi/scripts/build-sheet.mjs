#!/usr/bin/env node
/*
  Prints the A3 sheet to PDF.

  `dist/sheet/index.html` is the page (see content/sheet.njk); this renders it
  with the Chrome that is already on the machine and writes the result under a
  versioned filename, so a link printed on paper keeps resolving after the
  model has moved on.

  Nothing is bundled. Chrome's `--print-to-pdf` honours the `@page` size and
  paints backgrounds when the page asks it to, which is everything the sheet
  needs — so there is no browser in devDependencies and no DevTools protocol
  code here.

  The build has to have run first: the nx `pdf` target depends on `build`.

  Env:
    CHROME_PATH   Chrome to use. Otherwise the usual names on PATH, then the
                  macOS app bundles.

  Usage:
    node scripts/build-sheet.mjs

  It writes static/downloads/naomi-v<version>.pdf, which is git-tracked and
  passthrough-copied into the site — that is how older versions stay
  reachable — and records what it was made from in sheets.json.

  Exit 0 on success, 1 on any failure. This writes an artefact we distribute,
  so every check here is fatal rather than a warning.
*/
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

import {
  builtAssetsDir,
  builtSheetPage,
  readable,
  sheetDir,
  sheetFilename,
} from "./sheet-file.mjs";
import { fontFaults, openPdf, pageFaults, sizeFaults } from "./sheet-checks.mjs";
import {
  contentDigest,
  manifestName,
  renderDigest,
  sha256,
  writeManifest,
} from "./sheet-manifest.mjs";

const die = (msg) => {
  console.error(`build-sheet: ${msg}`);
  process.exit(1);
};

/* ---- finding Chrome ------------------------------------------------- */

/*
  The one thing about this script's environment that can be missing, so it
  gets a real error rather than ENOENT from a spawn. Tell the two mistakes
  apart: an unset CHROME_PATH is "you have no Chrome", a set-but-wrong one is
  "the path you gave me is not it", and those want different fixes.
*/
const ON_PATH = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];

// Only macOS hides Chrome somewhere PATH will not find it; everywhere else
// ON_PATH is the answer.
const APP_BUNDLES =
  process.platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      ]
    : [];

// Existing and executable is not the same as being Chrome — a stale
// CHROME_PATH pointing at any binary would otherwise fail much later, as an
// empty PDF. Ask for a version string and insist it looks like one.
function chromeVersion(bin) {
  const probe = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 15_000 });
  if (probe.error || probe.status !== 0) return null;
  return /\b(chrome|chromium)\b.*?\b(\d+)\./i.test(probe.stdout ?? "") ? probe.stdout.trim() : null;
}

function resolveChrome() {
  const explicit = process.env.CHROME_PATH;
  if (explicit) {
    const version = chromeVersion(explicit);
    if (version) return { bin: explicit, version };
    die(
      `CHROME_PATH is set to ${explicit}, which is not a working Chrome.

` +
        `It was asked for --version and did not answer like one. Correct it, or
` +
        `unset CHROME_PATH to fall back to the usual locations.`,
    );
  }

  for (const bin of [...ON_PATH, ...APP_BUNDLES]) {
    const version = chromeVersion(bin);
    if (version) return { bin, version };
  }

  die(
    `no usable Chrome found.

` +
      `Looked for (${process.platform}):
` +
      `  $CHROME_PATH (not set)
` +
      `  ${ON_PATH.join(", ")} (not on PATH)
` +
      APP_BUNDLES.map(
        (p) => `  ${p} (not found)
`,
      ).join("") +
      `
` +
      `The sheet is rendered by the Chrome you already have — nothing is bundled.
` +
      `Fix by one of:
` +
      `  - install Google Chrome           https://google.com/chrome
` +
      `  - point at an existing install    CHROME_PATH=/path/to/chrome npm run naomi:pdf`,
  );
}

/* ---- rendering ------------------------------------------------------- */

const outDir = fileURLToPath(sheetDir);
const source = fileURLToPath(builtSheetPage);

if (!statSync(source, { throwIfNoEntry: false })) {
  die(`${source} is missing — run the build first (npx nx run @jasonduffett-net/naomi:build).`);
}

const { bin, version } = resolveChrome();
const target = join(outDir, sheetFilename);

/*
  Chrome renders to a scratch name and the result is only moved into place once
  it has been checked. A sheet that does not fit one page must never exist at
  the path the site links and git tracks, even briefly — there is no CI step
  rendering a second copy to catch it afterwards.
*/
const scratch = `${target}.pending`;
mkdirSync(outDir, { recursive: true });

const flags = [
  "--headless",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--print-to-pdf=${scratch}`,
  pathToFileURL(source).href,
];

// Chrome's sandbox cannot start as root, which is how it tends to be run
// inside a container. Narrowed to that case rather than passed always: on a
// normal machine the sandbox should stay on.
if (process.getuid?.() === 0) flags.unshift("--no-sandbox");

try {
  execFileSync(bin, flags, { stdio: ["ignore", "ignore", "pipe"], timeout: 120_000 });
} catch (err) {
  die(`Chrome failed to render the sheet.\n\n${err.stderr?.toString().trim() ?? err.message}`);
}

/* ---- is it the sheet, or just a file? -------------------------------- */

/*
  Everything that has to be true before this replaces what we distribute, asked
  of the scratch file. The checks live in sheet-checks.mjs because the test
  asks the same questions of every sheet in the archive; only the reaction
  differs.

  All of them run, so a bad render reports everything wrong with it rather than
  one thing at a time.
*/
const reject = (faults) => {
  rmSync(scratch, { force: true });
  die(`the render was not published.\n\n${faults.map((f) => `  - ${f}`).join("\n")}`);
};

let bytes;
try {
  bytes = readFileSync(scratch);
} catch {
  die(`Chrome reported success but wrote nothing to ${scratch}.`);
}

let doc;
try {
  doc = await openPdf(bytes);
} catch (err) {
  reject([`Chrome wrote something it cannot read back as a PDF: ${err.message}`]);
}

const faults = [...sizeFaults(bytes), ...(await pageFaults(doc)), ...fontFaults(bytes)];
if (faults.length) reject(faults);

renameSync(scratch, target);

/* ---- record what it was made from ------------------------------------ */

writeManifest(sheetFilename, {
  generated: new Date().toISOString().slice(0, 10),
  chrome: version,
  bytes: bytes.length,
  sha256: sha256(bytes),
  content: contentDigest(source),
  render: renderDigest(source, fileURLToPath(builtAssetsDir)),
});

console.log(`[sheet] ${basename(target)} — one A3 page, ${readable(bytes.length)}, ${version}`);
console.log(`[sheet] ${target}`);
console.log(`[sheet] recorded in ${manifestName}`);
