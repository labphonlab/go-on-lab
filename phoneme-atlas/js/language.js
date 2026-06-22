// Language page: the core parallel-inventory display.
// Inventories are shown next to each other and never merged. Colour coding only
// *describes* agreement between the sources; it does not alter the data.

(async function () {
  const gc = getParam("g");
  const header = document.getElementById("header");
  if (!gc) { header.innerHTML = "<p>No language specified.</p>"; return; }

  const langs = await Data.languages();
  const lang = langs.find((l) => l.glottocode === gc);
  const index = await Data.inventoryIndex();
  const invs = index.byGlottocode[gc] || [];

  if (!lang || !invs.length) {
    header.innerHTML = `<h1>Unknown language</h1><p class="muted">No inventory found for <code>${esc(gc)}</code>.</p>`;
    renderFooter(document.getElementById("footer"));
    return;
  }

  document.title = `${lang.name} — Phoneme Atlas`;

  // ---- Header / metadata --------------------------------------------------
  header.innerHTML = `
    <h1>${esc(lang.name)}
      ${invs.length > 1 ? `<span class="badge warn">${invs.length} inventories</span>` : ""}</h1>
    <table class="kv">
      <tr><td class="k">Glottocode</td><td>${esc(lang.glottocode)}</td></tr>
      <tr><td class="k">ISO 639-3</td><td>${esc(lang.iso || "—")}</td></tr>
      <tr><td class="k">Family</td><td>${esc(lang.family || "—")}</td></tr>
      <tr><td class="k">Macroarea</td><td>${esc(lang.macroarea || "—")}</td></tr>
      <tr><td class="k">Sources</td><td>${invs.map((i) => esc(i.source)).join(", ")}</td></tr>
    </table>`;

  // ---- Agreement bookkeeping (describe, don't merge) ----------------------
  const setList = invs.map((inv) => new Set(inv.segments));
  const union = new Set();
  setList.forEach((s) => s.forEach((x) => union.add(x)));
  const common = [...union].filter((seg) => setList.every((s) => s.has(seg)));
  const commonSet = new Set(common);

  // Count in how many inventories each segment appears.
  const freq = {};
  union.forEach((seg) => {
    freq[seg] = setList.reduce((n, s) => n + (s.has(seg) ? 1 : 0), 0);
  });

  const singleNote = document.getElementById("single-note");
  if (invs.length === 1) {
    singleNote.innerHTML = `<p class="notice">Only one inventory is on record for
      this language, so there is nothing to compare here yet — colour coding is
      reserved for languages with multiple sources.</p>`;
  }

  // ---- Render one column per inventory -------------------------------------
  const grid = document.getElementById("grid");
  grid.innerHTML = invs.map((inv) => {
    const segHTML = orderSegments(inv.segments).map((seg) => {
      let cls = "seg";
      if (invs.length > 1) {
        if (commonSet.has(seg)) cls += " common";
        else if (freq[seg] === 1) cls += " unique";
      }
      if (inv.marginal && inv.marginal.includes(seg)) cls += " marginal";
      return `<a class="${cls}" href="segment.html?s=${encodeURIComponent(seg)}" title="${esc(seg)}">${esc(seg)}</a>`;
    }).join("");
    const onlyHere = invs.length > 1
      ? inv.segments.filter((s) => freq[s] === 1).length : 0;
    return `<div class="inv-col">
      <h3><span class="src">${esc(inv.source)}</span>
          <span class="count">${inv.n_segments} segments</span></h3>
      ${inv.dialect ? `<div class="dialect">${esc(inv.dialect)}</div>` : ""}
      <div class="count muted small">PHOIBLE inventory #${inv.inventory_id}${
        invs.length > 1 ? ` · ${onlyHere} unique to this source` : ""}</div>
      <div class="segs">${segHTML}</div>
    </div>`;
  }).join("");

  // ---- Agreement summary --------------------------------------------------
  if (invs.length > 1) {
    document.getElementById("agreement").innerHTML = `
      <div class="card">
        <h2 style="margin-top:0">Agreement across these ${invs.length} sources</h2>
        <p>The ${invs.length} inventories together name <strong>${union.size}</strong>
        distinct segments, but only <strong>${common.length}</strong> of them appear
        in <em>every</em> inventory. That leaves
        <strong>${union.size - common.length}</strong> segments on which the sources
        disagree — the gap a merged database would hide.</p>
        <p class="muted small">Common to all: ${common.map((s) =>
          `<a class="seg common" href="segment.html?s=${encodeURIComponent(s)}">${esc(s)}</a>`).join(" ") || "—"}</p>
      </div>`;
  }

  renderFooter(document.getElementById("footer"));

  // Roughly order segments: consonants, then vowels, then tones, alphabetical.
  function orderSegments(list) {
    return [...list].sort((a, b) => a.localeCompare(b));
  }
})();
