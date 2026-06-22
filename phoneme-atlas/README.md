# Phoneme Atlas

A web database of phoneme inventories that **shows multiple descriptions of the
same language side by side instead of merging them**. Built on
[PHOIBLE 2.0](https://phoible.org) and [Glottolog](https://glottolog.org), it is
the database half of a two-part project (book + web database) that critically
continues Ladefoged & Maddieson's *The Sounds of the World's Languages*.

The core design principle comes from Simpson (1999) and Hammarström et al.
(2023): integrating phoneme inventories hides the genuine disagreement between
sources. This atlas refuses to hide it — every inventory keeps its source, and
disagreement is displayed rather than resolved.

## Layout

```
phoneme-atlas/
├── index.html        # search + world map
├── language.html     # one language: inventories shown in parallel (the core)
├── segment.html      # browse segments + map one segment's distribution
├── about.html        # design principles, licensing, references
├── css/style.css
├── js/               # vanilla JS: data.js, main.js, language.js, segment.js
├── data/             # static JSON consumed by the site (committed)
│   ├── languages.json      # one record per language + Glottolog metadata
│   ├── inventories.json    # one record per inventory (kept separate, with source)
│   ├── segments.json       # per-segment summary index
│   ├── meta.json           # dataset counts + provenance + disclaimer
│   └── inconsistency_analysis.csv   # one row per inventory (Task 2 output)
├── scripts/          # Python data pipeline (run in order)
│   ├── 00_download_data.py        # fetch raw PHOIBLE + Glottolog (-> data-raw/)
│   ├── 01_join_glottolog.py       # join on Glottocode -> data-raw/phoible_with_geo.csv
│   ├── 02_inconsistency_analysis.py  # -> data/inconsistency_analysis.csv, analysis_report.md
│   └── 03_build_json.py           # -> data/*.json for the site
├── data-raw/         # raw + intermediate CSVs (git-ignored, re-downloadable)
└── analysis_report.md  # human-readable inconsistency findings (book Ch.4 input)
```

## Rebuilding the data

Requires Python 3 with `pandas`.

```bash
cd phoneme-atlas
python3 scripts/00_download_data.py        # downloads ~24 MB into data-raw/
python3 scripts/01_join_glottolog.py
python3 scripts/02_inconsistency_analysis.py
python3 scripts/03_build_json.py
```

The committed `data/*.json` are the output of this pipeline, so the site works
without re-running it.

## Running locally

The site is fully static; just serve the folder:

```bash
cd phoneme-atlas
python3 -m http.server 8000
# open http://localhost:8000
```

(`fetch()` needs HTTP, so opening `index.html` via `file://` will not load the
data.) For deployment, GitHub Pages serving this directory works as-is.

## Data sources & licensing

- **PHOIBLE 2.0** — Moran, S. & McCloy, D. (eds.) 2019. CC BY 4.0.
- **Glottolog** (CLDF) — Hammarström, Forkel, Haspelmath & Bank. CC BY 4.0.

This atlas reproduces that data under CC BY 4.0 and adds no claims of its own to
the inventories.

## Coverage caveat

PHOIBLE is a convenience sample covering roughly 2% of the world's languages,
with strong areal and historical biases. Counts here describe the database, not
the world.
