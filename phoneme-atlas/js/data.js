// Shared data-loading utilities for Phoneme Atlas.
// All pages load the same small set of static JSON files (built by
// scripts/03_build_json.py) and cache them on `window`.

const DATA_BASE = "data/";

const _cache = {};

async function loadJSON(name) {
  if (_cache[name]) return _cache[name];
  const res = await fetch(DATA_BASE + name + ".json");
  if (!res.ok) throw new Error("Failed to load " + name + ".json");
  const json = await res.json();
  _cache[name] = json;
  return json;
}

const Data = {
  languages: () => loadJSON("languages"),
  inventories: () => loadJSON("inventories"),
  segments: () => loadJSON("segments"),
  meta: () => loadJSON("meta"),

  // Index inventories by id and by glottocode (built lazily, once).
  // Returns { byId, byGlottocode }.
  async inventoryIndex() {
    if (_cache._index) return _cache._index;
    const invs = await loadJSON("inventories");
    const byId = {};
    const byGlottocode = {};
    for (const inv of invs) {
      byId[inv.inventory_id] = inv;
      if (inv.glottocode) {
        (byGlottocode[inv.glottocode] = byGlottocode[inv.glottocode] || []).push(inv);
      }
    }
    _cache._index = { byId, byGlottocode };
    return _cache._index;
  },
};

// Read a query-string parameter.
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Escape text for safe insertion into HTML.
function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Render the standard provenance/disclaimer footer used on every page.
async function renderFooter(el) {
  const meta = await Data.meta();
  const srcLines = meta.data_sources
    .map((d) => `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a> (${esc(d.license)})`)
    .join(" · ");
  el.innerHTML = `
    <p class="disclaimer">${esc(meta.disclaimer)}</p>
    <p class="muted small">Data: ${srcLines}. This site reproduces source data
    under CC BY 4.0 and adds no claims of its own to the inventories.</p>`;
}
