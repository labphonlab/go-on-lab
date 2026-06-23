#!/usr/bin/env python3
"""Task 2 — Deepening the cross-inventory inconsistency analysis.

This is the empirical backbone of the project's design argument (Simpson 1999;
Hammarström et al. 2023): when the *same* language is described by several
inventories, the inventories disagree — and merging them hides that. We measure
the disagreement instead of erasing it.

Produces
--------
data/inconsistency_analysis.csv : one row per inventory
    Glottocode, LanguageName, Macroarea, Source, InventoryID, n_segments
analysis_report.md              : human-readable summary (also feeds book Ch.4)

Analyses
--------
0. Baseline: languages with multiple inventories; size spread.
1. Systematic differences between source pairs (mean inventory-size gap).
2. Which segment types are most "controversial" (present in some but not all
   inventories of the same language).
3. Macroarea-level inconsistency.
"""
import os
import itertools
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.normpath(os.path.join(HERE, "..", "data-raw"))
DATA = os.path.normpath(os.path.join(HERE, "..", "data"))
ROOT = os.path.normpath(os.path.join(HERE, ".."))


def first_macroarea(val):
    if pd.isna(val):
        return "Unknown"
    return str(val).split(";")[0]


def main():
    df = pd.read_csv(os.path.join(RAW, "phoible_with_geo.csv"), low_memory=False)
    df["MacroareaClean"] = df["Macroarea"].map(first_macroarea)

    # ---- Per-inventory table -------------------------------------------------
    inv = (df.groupby(["InventoryID", "Glottocode", "LanguageName",
                       "MacroareaClean", "Source"])
             .agg(n_segments=("Phoneme", "nunique"))
             .reset_index()
             .rename(columns={"MacroareaClean": "Macroarea"}))
    inv = inv.sort_values(["Glottocode", "Source", "InventoryID"])

    os.makedirs(DATA, exist_ok=True)
    inv.to_csv(os.path.join(DATA, "inconsistency_analysis.csv"), index=False)

    # ---- Analysis 0: baseline spread ----------------------------------------
    per_lang = inv.groupby("Glottocode").agg(
        n_inv=("InventoryID", "nunique"),
        min_seg=("n_segments", "min"),
        max_seg=("n_segments", "max"),
        name=("LanguageName", "first"),
    )
    per_lang["spread"] = per_lang["max_seg"] - per_lang["min_seg"]
    multi = per_lang[per_lang["n_inv"] >= 2]

    n_multi = len(multi)
    n_spread10 = (multi["spread"] >= 10).sum()
    n_spread20 = (multi["spread"] >= 20).sum()
    top_spread = multi.sort_values("spread", ascending=False).head(15)

    # English (stan1293): how many segments are common to all its inventories?
    def common_count(glottocode):
        sub = df[df["Glottocode"] == glottocode]
        invs = sub.groupby("InventoryID")["Phoneme"].apply(set)
        if len(invs) < 2:
            return None
        common = set.intersection(*invs)
        union = set.union(*invs)
        return len(invs), len(common), len(union)

    eng = common_count("stan1293")

    # ---- Analysis 1: source-pair systematic differences ---------------------
    # For each pair of sources, among languages described by BOTH, mean gap in
    # (mean) inventory size.
    src_size = (inv.groupby(["Glottocode", "Source"])["n_segments"]
                   .mean().reset_index())
    sources = sorted(inv["Source"].unique())
    pair_rows = []
    for a, b in itertools.combinations(sources, 2):
        wide = src_size[src_size["Source"].isin([a, b])]
        piv = wide.pivot(index="Glottocode", columns="Source",
                         values="n_segments").dropna(subset=[a, b])
        if len(piv) == 0:
            continue
        gap = (piv[a] - piv[b])
        pair_rows.append({
            "source_a": a, "source_b": b,
            "n_shared_languages": len(piv),
            "mean_a": round(piv[a].mean(), 1),
            "mean_b": round(piv[b].mean(), 1),
            "mean_signed_gap_a_minus_b": round(gap.mean(), 1),
            "mean_abs_gap": round(gap.abs().mean(), 1),
        })
    pairs = pd.DataFrame(pair_rows).sort_values("mean_abs_gap", ascending=False)

    # Per-source overall mean size (for context).
    src_mean = inv.groupby("Source")["n_segments"].mean().round(1).sort_values()

    # ---- Analysis 2: most controversial segments ----------------------------
    # Among languages with >=2 inventories, for each segment count how often it
    # is "partial" (in some but not all inventories of that language) vs "full"
    # (in all inventories of every language where it appears at least once).
    multi_codes = set(multi.index)
    md = df[df["Glottocode"].isin(multi_codes)]
    inv_sets = md.groupby(["Glottocode", "InventoryID"])["Phoneme"].apply(set)
    seg_class = df.drop_duplicates("Phoneme").set_index("Phoneme")["SegmentClass"].to_dict()

    full = {}      # segment -> # languages where present in ALL inventories
    partial = {}   # segment -> # languages where present in SOME but not all
    for gc in multi_codes:
        sets = inv_sets.loc[gc]
        if isinstance(sets, set):  # single -> shouldn't happen for multi
            continue
        sets = list(sets)
        n = len(sets)
        union = set.union(*sets)
        for seg in union:
            cnt = sum(seg in s for s in sets)
            if cnt == n:
                full[seg] = full.get(seg, 0) + 1
            else:
                partial[seg] = partial.get(seg, 0) + 1

    seg_rows = []
    for seg in set(full) | set(partial):
        f, p = full.get(seg, 0), partial.get(seg, 0)
        tot = f + p
        if tot < 5:   # ignore rare segments to avoid noise
            continue
        seg_rows.append({
            "segment": seg,
            "segment_class": seg_class.get(seg, "?"),
            "n_languages": tot,
            "n_partial": p,
            "controversy": round(p / tot, 3),
        })
    seg_df = pd.DataFrame(seg_rows)
    # Most controversial = high controversy AND reasonably common.
    seg_common = seg_df[seg_df["n_languages"] >= 20].sort_values(
        "controversy", ascending=False)

    # ---- Analysis 3: macroarea-level inconsistency --------------------------
    area = (multi.reset_index()
                 .merge(inv[["Glottocode", "Macroarea"]].drop_duplicates("Glottocode"),
                        on="Glottocode", how="left"))
    area_report = area.groupby("Macroarea").agg(
        n_multi_inv_langs=("Glottocode", "nunique"),
        mean_spread=("spread", "mean"),
        median_spread=("spread", "median"),
        max_spread=("spread", "max"),
    ).round(1).sort_values("mean_spread", ascending=False)

    # ---- Write report -------------------------------------------------------
    lines = []
    w = lines.append
    w("# Cross-inventory inconsistency analysis\n")
    w("_Generated by `scripts/02_inconsistency_analysis.py` from PHOIBLE 2.0 "
      "joined with Glottolog._\n")
    w("> **Why this matters.** Existing phoneme-inventory databases routinely "
      "*merge* multiple descriptions of the same language into a single "
      "inventory. Doing so silently discards genuine disagreement between "
      "sources (Simpson 1999; Hammarström et al. 2023). The figures below "
      "quantify that disagreement — the data this project refuses to hide.\n")

    w("## 0. Baseline\n")
    w(f"- Languages with **≥2 inventories**: **{n_multi}**")
    w(f"- Of those, size spread (max−min segments) **≥10**: **{n_spread10}**; "
      f"**≥20**: **{n_spread20}**")
    if eng:
        n_e, c_e, u_e = eng
        w(f"- English (`stan1293`): **{n_e} inventories**, union of "
          f"**{u_e}** segments, but only **{c_e}** segments common to all "
          f"(**{u_e - c_e}** segments are disputed).\n")
    w("\nLargest size spreads (multi-inventory languages):\n")
    w("| Glottocode | Language | #inv | min | max | spread |")
    w("|---|---|--:|--:|--:|--:|")
    for gc, r in top_spread.iterrows():
        w(f"| {gc} | {r['name']} | {int(r['n_inv'])} | {int(r['min_seg'])} | "
          f"{int(r['max_seg'])} | {int(r['spread'])} |")

    w("\n## 1. Systematic differences between source pairs\n")
    w("For each pair of sources, among languages described by **both**, the "
      "mean gap in inventory size. A large signed gap = one source "
      "systematically reports bigger inventories than the other.\n")
    w("Per-source overall mean inventory size: " +
      ", ".join(f"`{s}`={v}" for s, v in src_mean.items()) + "\n")
    w("| source A | source B | shared langs | mean A | mean B | A−B | |A−B| |")
    w("|---|---|--:|--:|--:|--:|--:|")
    for _, r in pairs.head(20).iterrows():
        w(f"| {r['source_a']} | {r['source_b']} | {int(r['n_shared_languages'])} "
          f"| {r['mean_a']} | {r['mean_b']} | {r['mean_signed_gap_a_minus_b']} "
          f"| {r['mean_abs_gap']} |")

    w("\n## 2. Most controversial segments\n")
    w("Among multi-inventory languages, segments most often present in **some "
      "but not all** inventories of the same language (≥20 languages, ranked by "
      "share of languages where the segment is disputed).\n")
    w("| segment | class | #langs | #disputed | controversy |")
    w("|---|---|--:|--:|--:|")
    for _, r in seg_common.head(25).iterrows():
        w(f"| `{r['segment']}` | {r['segment_class']} | {int(r['n_languages'])} "
          f"| {int(r['n_partial'])} | {r['controversy']} |")

    w("\n## 3. Inconsistency by macroarea\n")
    w("Inventory-size spread among multi-inventory languages, by region.\n")
    w("| Macroarea | multi-inv langs | mean spread | median | max |")
    w("|---|--:|--:|--:|--:|")
    for ma, r in area_report.iterrows():
        w(f"| {ma} | {int(r['n_multi_inv_langs'])} | {r['mean_spread']} "
          f"| {r['median_spread']} | {int(r['max_spread'])} |")

    w("\n---\n")
    w("Data: PHOIBLE 2.0 (Moran & McCloy 2019, CC BY 4.0); Glottolog "
      "(Hammarström et al., CC BY 4.0).\n")

    with open(os.path.join(ROOT, "analysis_report.md"), "w") as f:
        f.write("\n".join(lines) + "\n")

    print("Wrote data/inconsistency_analysis.csv and analysis_report.md")
    print(f"multi-inventory languages: {n_multi}; spread>=10: {n_spread10}; "
          f"spread>=20: {n_spread20}")
    if eng:
        print(f"English stan1293: {eng[0]} inv, {eng[1]} common of {eng[2]} union")


if __name__ == "__main__":
    main()
