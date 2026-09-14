import { readFileSync } from "node:fs";

/*
  The model, made ready for the page — and the only door to it.

  `model/naomi.json` is canonical and shared with the PDF generator. 
  It is never edited to suit the web view, and it
  lives outside `_data/` deliberately so Eleventy does not also expose it as a
  global: everything the templates see passes through here, where it is
  derived and checked.
*/

const source = JSON.parse(readFileSync(new URL("../model/naomi.json", import.meta.url), "utf8"));

const fail = (msg) => {
  throw new Error(`naomi.json: ${msg}`);
};

// Forwarding a renamed or emptied field ships the word "undefined", or a
// blank cell, with nothing failing. Check what we pass on.
function required(obj, fields, what) {
  if (!obj) fail(`${what} is missing`);
  fields.forEach((f) => {
    const v = obj[f];
    if (v === undefined || v === null || v === "") fail(`${what} has no "${f}"`);
  });
  return obj;
}

// Abbreviations are editorial judgement the model does not carry. Total by
// design: a new pillar fails the build with an instruction rather than
// falling back to its full name, which is the min-width this exists to fix.
const SHORT_LABELS = {
  "flow-recoverability": "Flow",
  verification: "Verif",
  context: "Ctx",
  "product-integrity": "Prod",
  "control-accountability": "Ctrl",
};

// Level id to its colour token in assets/styles.css. Load-bearing: the row
// carries the token inline, so this list is the mapping rather than a copy
// of one kept in step with CSS by hand.
const ACCENT_TOKENS = {
  l3: "--level-3",
  l2: "--level-2",
  l1: "--level-1",
  l0: "--level-0",
  "l-1": "--level-minus-1",
};

// The descriptions are consistently a claim then a gloss; the rail sets the
// claim in bold. If that stops being true, say so at build time rather than
// silently setting a whole description bold.
function splitClaim(text, what) {
  const at = text.indexOf(". ");
  if (at === -1) fail(`${what} is one sentence — the rail needs a claim and a gloss`);
  return { lead: text.slice(0, at + 1), rest: text.slice(at + 2) };
}

const levels = source.levels
  .slice()
  .sort((a, b) => b.ordinal - a.ordinal) // highest first: the matrix reads downward
  .map((l) => {
    required(l, ["id", "ordinal", "assurance", "description", "entitlement"], `level "${l.id}"`);
    const accent = ACCENT_TOKENS[l.id];
    if (!accent) fail(`level "${l.id}" has no colour token — add one to ACCENT_TOKENS`);
    return {
      id: l.id,
      accent,
      // A real minus, derived once so every call site agrees.
      ordinalLabel: String(l.ordinal).replace("-", "−"),
      assurance: l.assurance,
      entitlement: l.entitlement,
      remedial: l.ordinal < 0,
      ...splitClaim(l.description, `level "${l.id}" description`),
    };
  });

const pillars = source.pillars.map((p) => {
  required(p, ["id", "name", "promise"], `pillar "${p.id}"`);
  const abbr = SHORT_LABELS[p.id];
  if (!abbr) fail(`pillar "${p.id}" has no short label — add one to SHORT_LABELS`);
  return { id: p.id, name: p.name, promise: p.promise, abbr };
});

/*
  A cell is its behaviours, and the model ranks them no further than the
  order they are written in. Nothing here promotes one of them to a headline:
  the template renders them alike, and the stylesheet decides how many of
  them a given width has room for.
*/
const cells = {};
source.pillars.forEach((p) => {
  p.cells.forEach((c) => {
    const texts = c.behaviours.map((b, i) => {
      required(b, ["text"], `behaviour ${i + 1} of ${p.id}/${c.level}`);
      return b.text;
    });
    if (!texts.length) fail(`cell ${p.id}/${c.level} has no behaviours`);
    cells[`${c.level}.${p.id}`] = texts;
  });
});

// A missing cell renders as a blank td, so check the cross product is whole.
levels.forEach((l) =>
  pillars.forEach((p) => {
    if (!cells[`${l.id}.${p.id}`]) fail(`no cell for ${p.id} at level ${l.id}`);
  }),
);

const framing = required(source.framing.aiNative, ["definition", "markers"], "framing.aiNative");
if (!framing.markers.length) fail("framing.aiNative.markers is empty");

/*
  The introduction prints the ladder from the model's own short form, which is
  shared with the PDF and so is not derived here. Nothing in the JSON keeps it
  in step with the level names the matrix renders, so check it: rename a level
  and the sentence above the index would otherwise go on naming the old rung.
*/
const spine = required(
  source.framing.spine,
  ["shortForm", "plainGloss", "assessmentQuestion"],
  "framing.spine",
);
const rungs = levels
  .slice()
  .reverse() // levels are highest-first; the ladder reads up from the bottom
  .map((l) => l.assurance.toLowerCase())
  .join(" → ");
if (rungs !== spine.shortForm) {
  fail(`framing.spine.shortForm says "${spine.shortForm}" but the levels read "${rungs}"`);
}

export default {
  ...required(source.model, ["version", "date"], "model"),
  // Asserted rather than merely forwarded: the model is pre-1.0, and a
  // version bump that dropped the caveat would quietly ship it as finished.
  status: required(source.model.status, ["label", "note"], "model.status"),
  definition: framing.definition,
  markers: framing.markers,
  spine: {
    shortForm: spine.shortForm,
    plainGloss: spine.plainGloss,
    assessmentQuestion: spine.assessmentQuestion,
  },
  levels,
  pillars,
  cells,
};
