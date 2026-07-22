"""Output-priority scoring (第1層 3., AGENTS.md's "L1加重ND・FL指標による出題優先度スコア").

Honest scope: this is a simplified proxy, not the real thing —
  - FL (frequency level): a small hand-compiled frequency-band table
    (data_tables/frequency_bands_en.json), not the licensed NGSL dataset.
  - ND (phonological neighborhood density): computing real neighborhood
    density needs a full pronunciation dictionary (e.g. CMUdict) to count
    phonologically-similar words, which this pipeline doesn't load. As a
    stand-in, "L1加重" here means weighting by the L1-interference flags
    difficulty.py already computes (a proxy for perceptual confusability
    against Japanese, not true ND).

Both halves are designed to be swapped for the real data/computation later
by replacing the frequency-band file and this module's scoring function —
nothing downstream (schema.py, pipeline.py, report.py) needs to change.

Lower priority_score = present earlier (easier / higher-utility first),
per AGENTS.md's i+1 ordering principle.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

_TABLE_PATH = Path(__file__).resolve().parent.parent / "data_tables" / "frequency_bands_en.json"

# Content types where items are independent (a word list, isolated example
# sentences) and safe to reorder by difficulty. Sequential material
# (dialogue turns, a reading passage's sentences, a drill's cue order)
# would become incoherent if reordered, so it's scored but left in place.
REORDERABLE_CONTENT_TYPES = {"vocabulary_list", "grammar_note"}

UNKNOWN_WORD_BAND = 3.0  # words absent from the table default to mid-difficulty
L1_FLAG_WEIGHT = 0.5

_WORD_BANDS: dict[str, int] | None = None


def _load_word_bands() -> dict[str, int]:
    global _WORD_BANDS
    if _WORD_BANDS is None:
        raw = json.loads(_TABLE_PATH.read_text(encoding="utf-8"))["bands"]
        _WORD_BANDS = {word: int(band) for band, words in raw.items() for word in words}
    return _WORD_BANDS


def score_item(text: str, difficulty_flags: list[str]) -> float:
    """Lower = present earlier. Combines an average frequency-band (FL) over
    the item's words with a small nudge from L1-interference flag count."""
    bands = _load_word_bands()
    words = re.findall(r"[a-zA-Z']+", text.lower())
    known = [bands[w] for w in words if w in bands]
    avg_band = (sum(known) / len(known)) if known else UNKNOWN_WORD_BAND
    return round(avg_band - L1_FLAG_WEIGHT * len(difficulty_flags), 3)


def order_by_priority(content_type: str, indices_and_scores: list[tuple[int, float]]) -> list[int]:
    """Returns item indices in presentation order. Only reorders content
    types where item order carries no narrative/sequential meaning."""
    if content_type not in REORDERABLE_CONTENT_TYPES:
        return [i for i, _ in indices_and_scores]
    return [i for i, _ in sorted(indices_and_scores, key=lambda pair: pair[1])]
