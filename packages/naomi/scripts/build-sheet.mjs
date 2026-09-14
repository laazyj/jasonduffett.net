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
    node scripts/build-sheet.mjs [--out <dir>]

    --out   where to write. Defaults to static/downloads/, which is
            git-tracked and passthrough-copied into the site — that is how
            older versions stay reachable. CI points this at a temp dir to
            check the current model still fits without dirtying the tree.

  Exit 0 on success, 1 on any failure. This writes an artefact we distribute,
  so every check here is fatal rather than a warning.
*/
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

import { MIN_BYTES, sheetDir, sheetFilename } from "./sheet-file.mjs";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
  const tried = [];

  const explicit = process.env.CHROME_PATH;
  if (explicit) {
    const version = chromeVersion(explicit);
    if (version) return { bin: explicit, version };
    die(
      `CHROME_PATH is set to ${explicit}, which is not a working Chrome.\n\n` +
        `It was asked for --version and did not answer like one. Correct it, or\n` +
        `unset CHROME_PATH to fall back to the usual locations.`,
    );
  }
  tried.push("$CHROME_PATH (not set)");

  for (const name of ON_PATH) {
    const version = chromeVersion(name);
    if (version) return { bin: name, version };
  }
  tried.push(`${ON_PATH.join(", ")} (not on PATH)`);

  for (const path of APP_BUNDLES) {
    const version = chromeVersion(path);
    if (version) return { bin: path, version };
    tried.push(`${path} (not found)`);
  }

  die(
    `no usable Chrome found.\n\n` +
      `Looked for (${process.platform}):\n` +
      tried.map((t) => `  ${t}`).join("\n") +
      `\n\n` +
      `The sheet is rendered by the Chrome you already have — nothing is bundled.\n` +
      `Fix by one of:\n` +
      `  - install Google Chrome           https://google.com/chrome\n` +
      `  - point at an existing install    CHROME_PATH=/path/to/chrome npm run naomi:pdf\n` +
      `  - on CI, use the runner's preinstalled Chrome (ubuntu-latest has one)`,
  );
}

/* ---- rendering ------------------------------------------------------- */

/*
  One flag. Both spellings, because `--out=dir` silently falling through to
  the default would write a fit-check into the git-tracked directory the
  default points at — and anything unrecognised is a mistake worth stopping
  for, for the same reason.
*/
const argv = process.argv.slice(2);
let outDir = fileURLToPath(sheetDir);
for (let i = 0; i < argv.length; i++) {
  const eq = argv[i].startsWith("--out=");
  if (!eq && argv[i] !== "--out") die(`unrecognised argument ${argv[i]} (only --out <dir>)`);
  const value = eq ? argv[i].slice("--out=".length) : argv[++i];
  if (!value) die("--out needs a directory");
  outDir = resolve(value);
}
const source = join(packageDir, "dist", "sheet", "index.html");

if (!statSync(source, { throwIfNoEntry: false })) {
  die(`${source} is missing — run the build first (npx nx run @jasonduffett-net/naomi:build).`);
}

const { bin, version } = resolveChrome();
const target = join(outDir, sheetFilename);
mkdirSync(outDir, { recursive: true });

const flags = [
  "--headless",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--print-to-pdf=${target}`,
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

/* ---- did it actually produce a PDF? ---------------------------------- */

// Cheap checks only. That the sheet is one A3 page carrying every behaviour
// is what test/sheet.test.js asserts, against this same file.
let bytes;
try {
  bytes = readFileSync(target);
} catch {
  die(`Chrome reported success but wrote nothing to ${target}.`);
}

if (bytes.subarray(0, 5).toString() !== "%PDF-") {
  die(`${target} is not a PDF — it starts ${JSON.stringify(bytes.subarray(0, 16).toString())}.`);
}
if (bytes.length < MIN_BYTES) {
  die(`${target} is only ${bytes.length} bytes, which is too small to be the whole index.`);
}

console.log(`[sheet] ${basename(target)} — ${(bytes.length / 1024).toFixed(0)}KB, ${version}`);
console.log(`[sheet] ${target}`);
console.log(`[sheet] run \`npm test\` to check it is one A3 page and nothing is missing.`);
