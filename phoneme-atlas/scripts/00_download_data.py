#!/usr/bin/env python3
"""Download the raw source data (PHOIBLE 2.0 + Glottolog).

Raw files are written to ``phoneme-atlas/data-raw/`` and are intentionally
git-ignored — they are large and freely re-downloadable. Run this once before
the rest of the pipeline.

Sources
-------
PHOIBLE 2.0   : Moran, S. & McCloy, D. (eds.) 2019. CC BY 4.0
Glottolog     : Hammarström et al. CLDF release. CC BY 4.0
"""
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.normpath(os.path.join(HERE, "..", "data-raw"))

SOURCES = {
    "phoible.csv": "https://raw.githubusercontent.com/phoible/dev/master/data/phoible.csv",
    "glottolog_languages.csv": "https://raw.githubusercontent.com/glottolog/glottolog-cldf/master/cldf/languages.csv",
}


def main():
    os.makedirs(RAW, exist_ok=True)
    for fname, url in SOURCES.items():
        dest = os.path.join(RAW, fname)
        print(f"Downloading {url}\n  -> {dest}")
        urllib.request.urlretrieve(url, dest)
        size = os.path.getsize(dest)
        print(f"  done ({size/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
