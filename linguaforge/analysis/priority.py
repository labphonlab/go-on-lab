"""Output-priority scoring (第1層 3., AGENTS.md's "L1加重ND・FL指標による出題優先度スコア").

composite = freq_band(FL) - nd_weight * normalized(L1加重ND) - flag_weight * len(difficulty_flags)

  - FL (頻度帯): a small hand-compiled frequency-band table
    (data_tables/frequency_bands_en.json) — not the licensed NGSL dataset,
    but real, working data, swappable for it without touching this module
    (see README's "NGSL 1.2" section for why that swap hasn't happened yet).
  - L1加重ND: real neighborhood density via analysis/neighborhood.py
    (CMUdict-backed), no longer a proxy. Averaged over an item's
    in-CMUdict words, each squashed through nd/(nd+k) (a smooth 0-1
    asymptote, k = nd_half_saturation) since raw ND counts for common
    short words are often 80-150+ and live on a different scale than the
    1-5 frequency bands — a hard cap saturates almost everything to 1.0.
  - difficulty_flags: kept as a small additional nudge because it captures
    connected-speech phenomena (weak forms, contractions, palatalization)
    that are properties of a phrase, not a single word's phonological
    neighborhood — ND can't represent those at all.

All three weights live in data_tables/priority_weights.json so they can be
retuned without touching code.

Lower priority_score = present earlier (easier / higher-utility first),
per AGENTS.md's i+1 ordering principle.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from . import neighborhood

_BANDS_PATH = Path(__file__).resolve().parent.parent / "data_tables" / "frequency_bands_en.json"
_WEIGHTS_PATH = Path(__file__).resolve().parent.parent / "data_tables" / "priority_weights.json"

# Content types where items are independent (a word list, isolated example
# sentences) and safe to reorder by difficulty. Sequential material
# (dialogue turns, a reading passage's sentences, a drill's cue order)
# would become incoherent if reordered, so it's scored but left in place.
REORDERABLE_CONTENT_TYPES = {"vocabulary_list", "grammar_note"}

UNKNOWN_WORD_BAND = 3.0  # words absent from the frequency table default to mid-difficulty

_WORD_BANDS: dict[str, int] | None = None
_WEIGHTS: dict | None = None


def _load_word_bands() -> dict[str, int]:
    global _WORD_BANDS
    if _WORD_BANDS is None:
        raw = json.loads(_BANDS_PATH.read_text(encoding="utf-8"))["bands"]
        _WORD_BANDS = {word: int(band) for band, words in raw.items() for word in words}
    return _WORD_BANDS


def _load_weights() -> dict:
    global _WEIGHTS
    if _WEIGHTS is None:
        _WEIGHTS = json.loads(_WEIGHTS_PATH.read_text(encoding="utf-8"))
    return _WEIGHTS


def _words_in(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z']+", text.lower())


def score_item(text: str, difficulty_flags: list[str]) -> float:
    """Lower = present earlier."""
    weights = _load_weights()
    words = _words_in(text)

    bands = _load_word_bands()
    known_bands = [bands[w] for w in words if w in bands]
    avg_band = (sum(known_bands) / len(known_bands)) if known_bands else UNKNOWN_WORD_BAND

    nd_canonical_index = neighborhood.default_canonical_index()
    half_sat = weights["nd_half_saturation"]
    nd_signals = []
    for w in words:
        l1_nd = neighborhood.compute_l1_weighted_nd(w, nd_canonical_index)
        if l1_nd is not None:
            nd_signals.append(l1_nd / (l1_nd + half_sat))
    avg_nd_signal = (sum(nd_signals) / len(nd_signals)) if nd_signals else 0.0

    score = avg_band - weights["nd_weight"] * avg_nd_signal - weights["flag_weight"] * len(difficulty_flags)
    return round(score, 3)


def word_neighborhood_density(word: str) -> tuple[int | None, int | None]:
    """(nd, nd_l1_weighted) for a single word, or (None, None) if it isn't
    in CMUdict. Exposed for pipeline.py to attach to single-word items."""
    return neighborhood.score(word)


def order_by_priority(content_type: str, indices_and_scores: list[tuple[int, float]]) -> list[int]:
    """Returns item indices in presentation order. Only reorders content
    types where item order carries no narrative/sequential meaning."""
    if content_type not in REORDERABLE_CONTENT_TYPES:
        return [i for i, _ in indices_and_scores]
    return [i for i, _ in sorted(indices_and_scores, key=lambda pair: pair[1])]
