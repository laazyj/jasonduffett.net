/* The index.

   Three ways in, one state model: open a single cell, a whole level (row),
   or a whole pillar (column). Opening sets .is-expanded on the affected
   row(s) and .is-open on the cell(s); the stylesheet does the rest.

   The density rung follows the viewport. The page works without this file:
   with no `data-rung` set, the ladder in the stylesheet subtracts nothing
   and every cell renders in full. That is also what print gets. */
(function () {
  "use strict";

  const wrap = document.querySelector(".m-wrap");
  if (!wrap) return;

  const table = wrap.querySelector("table.m");
  const rows = Array.from(table.querySelectorAll(".m-row"));
  const pillars = Array.from(table.querySelectorAll(".m-col-btn"), (b) => b.dataset.col);
  const levels = rows.map((r) => r.dataset.level);

  // Built once: the grid is static, so every later lookup is a map hit
  // rather than an attribute-selector query.
  const cellBtns = new Map();
  table.querySelectorAll(".m-cell-btn").forEach((b) => {
    cellBtns.set(b.dataset.cell + "." + b.dataset.level, b);
  });
  const cellAt = (p, l) => cellBtns.get(p + "." + l);
  const rowFor = (l) => rows[levels.indexOf(l)];

  /* ---- density rungs ------------------------------------------------ */

  // Thresholds are viewport widths, in px to match the stylesheet's own
  // media queries. Note those resolve `rem` against 16px, not the 18px
  // root, which is why neither expresses these in rem.
  const RUNGS = [
    { rung: "full", min: 1200 },
    { rung: "condensed", min: 1000 },
    { rung: "collapsed", min: 700 },
    { rung: "glyph", min: 0 },
  ];

  function applyRung() {
    const rung = RUNGS.find((r) => window.innerWidth >= r.min).rung;
    if (wrap.dataset.rung !== rung) wrap.dataset.rung = rung;
  }

  /* ---- open / close -------------------------------------------------- */

  // What is currently open, so collapsing touches only those elements
  // rather than rewriting all 25 cells on every click.
  const openCells = [];
  const openRows = [];
  const openBtns = [];

  const isOpen = (btn) => btn.getAttribute("aria-expanded") === "true";

  function collapseAll() {
    if (!openBtns.length) return;
    openCells.forEach((c) => {
      c.classList.remove("is-open");
      c.colSpan = 1;
    });
    openRows.forEach((r) => r.classList.remove("is-expanded"));
    openBtns.forEach((b) => b.setAttribute("aria-expanded", "false"));
    openCells.length = openRows.length = openBtns.length = 0;
    setHash(null);
  }

  function mark(btn) {
    btn.setAttribute("aria-expanded", "true");
    openBtns.push(btn);
  }

  // `span` spreads the cell across the pillar columns so it gets the full
  // width; a whole-row open leaves the columns as they are.
  function expandCell(cell, span) {
    cell.classList.add("is-open");
    if (span) cell.colSpan = pillars.length;
    openCells.push(cell);
    mark(cell.querySelector(".m-cell-btn"));
  }

  function expandRow(row) {
    row.classList.add("is-expanded");
    openRows.push(row);
  }

  function openCell(p, l) {
    const btn = cellAt(p, l);
    const already = isOpen(btn);
    collapseAll();
    if (already) return;
    expandRow(rowFor(l));
    expandCell(btn.closest(".m-cell"), true);
    setHash(btn.id);
  }

  function openRow(l) {
    const btn = table.querySelector(`.m-rail-btn[data-row="${l}"]`);
    const already = isOpen(btn);
    collapseAll();
    if (already) return;
    const row = rowFor(l);
    expandRow(row);
    row.querySelectorAll(".m-cell").forEach((c) => expandCell(c, false));
    mark(btn);
  }

  function openCol(p) {
    const btn = table.querySelector(`.m-col-btn[data-col="${p}"]`);
    const already = isOpen(btn);
    collapseAll();
    if (already) return;
    rows.forEach((r) => {
      expandRow(r);
      expandCell(r.querySelector(`.m-cell[data-pillar="${p}"]`), true);
    });
    mark(btn);
  }

  // A cell is worth linking to on its own; a whole row or column is not.
  function setHash(id) {
    const want = id ? "#" + id : "";
    if (location.hash === want) return;
    history.replaceState(null, "", id ? want : location.pathname + location.search);
  }

  /* ---- keyboard ------------------------------------------------------ */

  const DELTAS = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowDown: [0, 1],
    ArrowUp: [0, -1],
  };

  // Hidden behind an expansion, per the stylesheet's one hiding rule. Read
  // from state rather than measuring, which would force a layout flush.
  function isCellHidden(btn) {
    const cell = btn.closest(".m-cell");
    return (
      cell.closest(".m-row").classList.contains("is-expanded") &&
      !cell.classList.contains("is-open")
    );
  }

  // Arrow keys walk the grid. A cell hidden behind an expansion is reached
  // by collapsing that expansion first, so focus is never trapped.
  function focusCell(pi, li) {
    if (pi < 0 || pi >= pillars.length || li < 0 || li >= levels.length) return;
    const btn = cellAt(pillars[pi], levels[li]);
    if (isCellHidden(btn)) collapseAll();
    btn.focus();
  }

  table.addEventListener("keydown", (e) => {
    const btn = e.target.closest(".m-cell-btn");
    if (btn) {
      const pi = pillars.indexOf(btn.dataset.cell);
      const li = levels.indexOf(btn.dataset.level);
      const d = DELTAS[e.key];
      if (d) {
        e.preventDefault();
        return focusCell(pi + d[0], li + d[1]);
      }
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        return focusCell(e.key === "Home" ? 0 : pillars.length - 1, li);
      }
    }
    if (e.key === "Escape") collapseAll();
  });

  /* ---- wiring -------------------------------------------------------- */

  // One delegated listener for all three ways in.
  table.addEventListener("click", (e) => {
    const cell = e.target.closest(".m-cell-btn");
    if (cell) return openCell(cell.dataset.cell, cell.dataset.level);
    const rail = e.target.closest(".m-rail-btn");
    if (rail) return openRow(rail.dataset.row);
    const col = e.target.closest(".m-col-btn");
    if (col) openCol(col.dataset.col);
  });

  // Only crossings matter, so listen for those rather than debouncing every
  // frame of a resize.
  RUNGS.forEach((r) => {
    if (r.min > 0)
      window.matchMedia(`(min-width: ${r.min}px)`).addEventListener("change", applyRung);
  });

  applyRung();

  /* ---- deep links ----------------------------------------------------- */

  // #cell-<pillar>-<level> opens that cell — on arrival, and on any later
  // fragment change, which is a same-document navigation that would
  // otherwise leave the matrix untouched.
  function openFromHash() {
    const target = document.getElementById(location.hash.slice(1));
    if (!target || !target.classList.contains("m-cell-btn") || isOpen(target)) return;
    openCell(target.dataset.cell, target.dataset.level);
    target.scrollIntoView({ block: "center" });
  }

  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
