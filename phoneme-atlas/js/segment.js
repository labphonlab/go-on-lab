// Segment page: browse the segment index, or (with ?s=) map one segment's
// geographic distribution.

(async function () {
  const seg = getParam("s");
  const segments = await Data.segments();
  const meta = await Data.meta();
  document.getElementById("nseg").textContent = meta.n_segments.toLocaleString();

  if (seg) { await showDetail(seg); }
  else { showBrowse(); }
  renderFooter(document.getElementById("footer"));

  // ---- Browse view --------------------------------------------------------
  function showBrowse() {
    const q = document.getElementById("q");
    const results = document.getElementById("results");
    const top = document.getElementById("top");

    top.innerHTML = segments.slice(0, 60).map((s) =>
      `<a class="seg" href="segment.html?s=${encodeURIComponent(s.segment)}"
         title="${esc(s.n_languages)} languages">${esc(s.segment)}</a>`).join("");

    q.addEventListener("input", () => {
      const term = q.value.trim();
      if (!term) { results.innerHTML = ""; return; }
      const hits = segments.filter((s) => s.segment.includes(term)).slice(0, 50);
      results.innerHTML = hits.map((s) =>
        `<li><a href="segment.html?s=${encodeURIComponent(s.segment)}">
          <span class="seg" style="cursor:inherit">${esc(s.segment)}</span>
          <span class="meta">${s.class || "—"} · ${s.n_languages} languages · ${s.n_inventories} inventories</span>
        </a></li>`).join("");
    });
    q.focus();
  }

  // ---- Detail view --------------------------------------------------------
  async function showDetail(seg) {
    document.getElementById("browse").style.display = "none";
    document.getElementById("detail").style.display = "";
    document.title = `${seg} — Phoneme Atlas`;

    const info = segments.find((s) => s.segment === seg);
    const langs = await Data.languages();
    const langById = {};
    langs.forEach((l) => { langById[l.glottocode] = l; });
    const index = await Data.inventoryIndex();
    const byGc = index.byGlottocode;

    // Languages having this segment in at least one inventory.
    const hits = [];
    for (const gc in byGc) {
      const invs = byGc[gc];
      const withSeg = invs.filter((inv) => inv.segments.includes(seg));
      if (withSeg.length) {
        hits.push({ gc, lang: langById[gc], n_with: withSeg.length, n_total: invs.length });
      }
    }

    document.getElementById("seg-header").innerHTML = `
      <h1><span class="seg" style="font-size:28px">${esc(seg)}</span></h1>
      <table class="kv">
        <tr><td class="k">Class</td><td>${esc(info ? info.class : "—")}</td></tr>
        <tr><td class="k">Languages</td><td>${info ? info.n_languages : hits.length}</td></tr>
        <tr><td class="k">Inventories</td><td>${info ? info.n_inventories : "—"}</td></tr>
      </table>`;

    const map = L.map("map", { worldCopyJump: true }).setView([20, 10], 2);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap, &copy; CARTO', maxZoom: 12,
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    for (const h of hits) {
      const l = h.lang;
      if (!l || l.lat == null || l.lon == null) continue;
      // Orange when the segment is disputed within the language (not in all invs).
      const disputed = h.n_total > 1 && h.n_with < h.n_total;
      const m = L.circleMarker([l.lat, l.lon], {
        radius: 4, weight: 1, fillOpacity: 0.7,
        color: disputed ? "#b35900" : "#0071e3",
      });
      m.bindPopup(`<strong>${esc(l.name)}</strong><br>` +
        `in ${h.n_with} of ${h.n_total} inventor${h.n_total === 1 ? "y" : "ies"}` +
        `${disputed ? " <em>(disputed)</em>" : ""}<br>` +
        `<a href="language.html?g=${esc(h.gc)}">Open language →</a>`);
      layer.addLayer(m);
    }
  }
})();
