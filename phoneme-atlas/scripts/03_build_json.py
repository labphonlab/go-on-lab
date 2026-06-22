#!/usr/bin/env python3
"""Task 3 (data step) — Convert the joined CSV into the static JSON the site uses.

Design principle: inventories are kept SEPARATE. ``inventories.json`` holds one
record per (InventoryID, Source); the front-end displays them side by side and
never merges them.

Outputs (written to phoneme-atlas/data/)
----------------------------------------
languages.json    : one record per language (Glottocode) + metadata
inventories.json  : one record per inventory, with its raw segment list + source
segments.json     : per-segment summary index (for search + the segment page)
meta.json         : dataset-level counts + source provenance, for the footer
"""
import os
import json
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.normpath(os.path.join(HERE, "..", "data-raw"))
DATA = os.path.normpath(os.path.join(HERE, "..", "data"))

# Human-readable names for PHOIBLE's source codes.
SOURCE_NAMES = {
    "spa": "Stanford Phonetics Archive (SPA)",
    "upsid": "UCLA Phonological Segment Inventory Database (UPSID)",
    "aa": "Alphabets of Africa",
    "ph": "PHOIBLE-curated (PH)",
    "gm": "Green & Moran",
    "ra": "Common Linguistic Features in Indian Languages: Phonetics (RA)",
    "saphon": "South American Phonological Inventory Database (SAPHON)",
    "ea": "European Archive (EA)",
    "er": "Eurasian (ER)",
}


def first_macroarea(val):
    if pd.isna(val):
        return None
    return str(val).split(";")[0]


def main():
    df = pd.read_csv(os.path.join(RAW, "phoible_with_geo.csv"), low_memory=False)

    # ---- inventories.json ---------------------------------------------------
    inventories = []
    for inv_id, g in df.groupby("InventoryID"):
        first = g.iloc[0]
        dialect = first.get("SpecificDialect")
        # Order segments by class then alphabetically for stable display.
        segs = (g[["Phoneme", "SegmentClass", "Marginal"]]
                .drop_duplicates("Phoneme"))
        seg_list = segs["Phoneme"].tolist()
        marginal = segs.loc[segs["Marginal"] == True, "Phoneme"].tolist()
        inventories.append({
            "inventory_id": int(inv_id),
            "glottocode": None if pd.isna(first["Glottocode"]) else first["Glottocode"],
            "name": first["LanguageName"],
            "dialect": None if pd.isna(dialect) else dialect,
            "source": first["Source"],
            "n_segments": len(seg_list),
            "segments": seg_list,
            "marginal": marginal,
        })
    inventories.sort(key=lambda r: (r["glottocode"] or "", r["source"]))

    # ---- languages.json -----------------------------------------------------
    languages = []
    for gc, g in df[df["Glottocode"].notna()].groupby("Glottocode"):
        first = g.iloc[0]
        inv_ids = sorted(g["InventoryID"].unique().tolist())
        sources = sorted(g["Source"].unique().tolist())
        lat, lon = first["Latitude"], first["Longitude"]
        languages.append({
            "glottocode": gc,
            "name": first["LanguageName"],
            "iso": None if pd.isna(first["ISO6393"]) else first["ISO6393"],
            "family": None if pd.isna(first.get("Family_Name")) else first["Family_Name"],
            "macroarea": first_macroarea(first.get("Macroarea")),
            "level": None if pd.isna(first.get("Level")) else first["Level"],
            "lat": None if pd.isna(lat) else round(float(lat), 4),
            "lon": None if pd.isna(lon) else round(float(lon), 4),
            "n_inventories": len(inv_ids),
            "inventory_ids": [int(i) for i in inv_ids],
            "sources": sources,
        })
    languages.sort(key=lambda r: r["name"].lower() if r["name"] else "")

    # ---- segments.json ------------------------------------------------------
    seg_rows = []
    seg_class = df.drop_duplicates("Phoneme").set_index("Phoneme")["SegmentClass"]
    by_seg = df.groupby("Phoneme")
    for seg, g in by_seg:
        seg_rows.append({
            "segment": seg,
            "class": seg_class.get(seg, None),
            "n_inventories": int(g["InventoryID"].nunique()),
            "n_languages": int(g["Glottocode"].nunique()),
        })
    seg_rows.sort(key=lambda r: -r["n_inventories"])

    # ---- meta.json ----------------------------------------------------------
    used_sources = sorted(df["Source"].unique().tolist())
    meta = {
        "n_inventories": int(df["InventoryID"].nunique()),
        "n_languages": int(df["Glottocode"].nunique()),
        "n_segments": int(df["Phoneme"].nunique()),
        "sources": [{"code": s, "name": SOURCE_NAMES.get(s, s)} for s in used_sources],
        "data_sources": [
            {"name": "PHOIBLE 2.0", "license": "CC BY 4.0",
             "citation": "Moran, S. & McCloy, D. (eds.) 2019. PHOIBLE 2.0. "
                         "Jena: Max Planck Institute for the Science of Human History.",
             "url": "https://phoible.org"},
            {"name": "Glottolog", "license": "CC BY 4.0",
             "citation": "Hammarström, H., Forkel, R., Haspelmath, M. & Bank, S. "
                         "Glottolog. Leipzig: Max Planck Institute for Evolutionary Anthropology.",
             "url": "https://glottolog.org"},
        ],
        "disclaimer": (
            "This is a convenience sample. PHOIBLE covers roughly 2% of the "
            "world's languages, with strong areal and historical biases. "
            "Multiple inventories of the same language are shown side by side "
            "and are never merged: disagreement between sources is data, not noise."
        ),
    }

    os.makedirs(DATA, exist_ok=True)
    for name, obj in [("inventories", inventories), ("languages", languages),
                      ("segments", seg_rows), ("meta", meta)]:
        path = os.path.join(DATA, f"{name}.json")
        with open(path, "w") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        print(f"Wrote {path}  ({os.path.getsize(path)/1e6:.2f} MB)")

    print(f"languages={len(languages)} inventories={len(inventories)} segments={len(seg_rows)}")


if __name__ == "__main__":
    main()
