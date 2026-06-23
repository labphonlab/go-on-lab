// Home page: language search + world map.

(async function () {
  const meta = await Data.meta();
  const langs = await Data.languages();

  document.getElementById("stats").textContent =
    `${meta.n_inventories.toLocaleString()} inventories · ` +
    `${meta.n_languages.toLocaleString()} languages · ` +
    `${meta.n_segments.toLocaleString()} distinct segments · ` +
    `${meta.sources.length} sources.`;

  // ---- Search -------------------------------------------------------------
  const q = document.getElementById("q");
  const results = document.getElementById("results");

  function render(list) {
    if (!list.length) { results.innerHTML = ""; return; }
    results.innerHTML = list.slice(0, 40).map((l) => {
      const multi = l.n_inventories > 1
        ? `<span class="badge warn">${l.n_inventories} inventories</span>` : "";
      return `<li><a href="language.html?g=${esc(l.glottocode)}">
        <span>${esc(l.name)} ${multi}</span>
        <span class="meta">${esc(l.glottocode)}${l.iso ? " · " + esc(l.iso) : ""}
          · ${esc(l.family || "—")} · ${esc(l.macroarea || "—")}</span>
      </a></li>`;
    }).join("");
  }

  function search(term) {
    term = term.trim().toLowerCase();
    if (!term) { results.innerHTML = ""; return; }
    const hits = langs.filter((l) =>
      (l.name && l.name.toLowerCase().includes(term)) ||
      (l.glottocode && l.glottocode.toLowerCase().includes(term)) ||
      (l.iso && l.iso.toLowerCase().includes(term)));
    // Prioritise: prefix matches on name, then multi-inventory languages.
    hits.sort((a, b) => {
      const ap = a.name && a.name.toLowerCase().startsWith(term) ? 0 : 1;
      const bp = b.name && b.name.toLowerCase().startsWith(term) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return b.n_inventories - a.n_inventories;
    });
    render(hits);
  }

  q.addEventListener("input", () => search(q.value));
  q.focus();

  // ---- Map ----------------------------------------------------------------
  const map = L.map("map", { worldCopyJump: true }).setView([20, 10], 2);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap, &copy; CARTO', maxZoom: 12,
  }).addTo(map);

  const layer = L.layerGroup().addTo(map);
  for (const l of langs) {
    if (l.lat == null || l.lon == null) continue;
    const multi = l.n_inventories > 1;
    const marker = L.circleMarker([l.lat, l.lon], {
      radius: multi ? 3 + Math.min(l.n_inventories, 6) : 3,
      color: multi ? "#b35900" : "#0071e3",
      weight: 1, fillOpacity: 0.65,
    });
    marker.bindPopup(
      `<strong>${esc(l.name)}</strong><br>${esc(l.glottocode)} · ${l.n_inventories} inventor${l.n_inventories === 1 ? "y" : "ies"}<br>` +
      `<a href="language.html?g=${esc(l.glottocode)}">Open language →</a>`);
    layer.addLayer(marker);
  }

  renderFooter(document.getElementById("footer"));
})();
