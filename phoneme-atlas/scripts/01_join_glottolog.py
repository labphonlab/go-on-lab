#!/usr/bin/env python3
"""Task 1 — Join PHOIBLE with Glottolog (genealogy + geography).

Joins on ``Glottocode`` and appends, per language:
    Family_ID, Family_Name, Latitude, Longitude, Macroarea, Level

Design principle: the join *adds* columns; it never merges or collapses
inventories. Every original PHOIBLE row (and its Source) is preserved so the
provenance of each segment stays intact.

Outputs
-------
data-raw/phoible_with_geo.csv  : PHOIBLE + Glottolog columns (git-ignored, large)
Also prints a join-quality report (unmatched Glottocodes, Macroarea spread).
"""
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.normpath(os.path.join(HERE, "..", "data-raw"))


def main():
    phoible = pd.read_csv(os.path.join(RAW, "phoible.csv"), low_memory=False)
    glotto = pd.read_csv(os.path.join(RAW, "glottolog_languages.csv"), low_memory=False)

    # Build a family-glottocode -> family-name lookup from Glottolog itself.
    fam_name = glotto.set_index("Glottocode")["Name"].to_dict()

    geo = glotto[["Glottocode", "Family_ID", "Latitude", "Longitude",
                  "Macroarea", "Level"]].copy()
    geo["Family_Name"] = geo["Family_ID"].map(fam_name)

    merged = phoible.merge(geo, on="Glottocode", how="left")

    out = os.path.join(RAW, "phoible_with_geo.csv")
    merged.to_csv(out, index=False)

    # ---- Join-quality report -------------------------------------------------
    n_rows = len(merged)
    matched = merged["Macroarea"].notna()
    n_unmatched_rows = (~matched).sum()

    # Per-language (Glottocode) view.
    lang = merged.drop_duplicates("Glottocode")
    n_lang = len(lang)
    n_lang_unmatched = lang["Macroarea"].isna().sum()
    unmatched_codes = sorted(lang.loc[lang["Macroarea"].isna(), "Glottocode"]
                             .dropna().unique())

    print(f"Wrote {out}")
    print(f"Rows: {n_rows}  (unmatched to Glottolog: {n_unmatched_rows})")
    print(f"Languages (Glottocodes): {n_lang}  (unmatched: {n_lang_unmatched})")
    if unmatched_codes:
        print(f"Unmatched Glottocodes: {unmatched_codes}")
    n_null_code = phoible["Glottocode"].isna().sum()
    print(f"PHOIBLE rows with no Glottocode at all: {n_null_code}")

    print("\nMacroarea distribution (languages / inventories):")
    inv = merged.drop_duplicates("InventoryID")
    by_lang = lang.groupby("Macroarea", dropna=False).size()
    by_inv = inv.groupby("Macroarea", dropna=False).size()
    report = pd.DataFrame({"languages": by_lang, "inventories": by_inv}).fillna(0).astype(int)
    print(report.to_string())


if __name__ == "__main__":
    main()
