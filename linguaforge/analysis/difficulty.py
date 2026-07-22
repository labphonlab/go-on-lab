"""Difficulty / priority flagging (解析層 3.).

Flags two independent things on every item:
  - L1-interference phoneme pairs (from data_tables/l1_interference_en_ja.json)
  - Connected speech processes (linking, assimilation, elision, contraction) —
    these get surfaced as listening-priority material per AGENTS.md.

Phase 2 will replace the phoneme lookup with an NGSL-based L1加重ND/FL priority
score; this module is deliberately just a table-driven pass so that swap is a
data change, not a code change.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

_TABLE_PATH = Path(__file__).resolve().parent.parent / "data_tables" / "l1_interference_en_ja.json"

# Weak-form / connected-speech surface forms that are worth flagging for
# listening practice regardless of phoneme content.
_REDUCTION_PATTERNS = [
    (re.compile(r"\bgonna\b", re.I), "reduction"),
    (re.compile(r"\bwanna\b", re.I), "reduction"),
    (re.compile(r"\bgotta\b", re.I), "reduction"),
    (re.compile(r"\bkinda\b", re.I), "reduction"),
    (re.compile(r"\blemme\b", re.I), "reduction"),
    (re.compile(r"\b\w+'(s|re|ll|ve|d|m|t)\b", re.I), "contraction"),
    (re.compile(r"\bd(o|id) you\b", re.I), "palatalization"),
    (re.compile(r"\b(would|could|should|did|had) you\b", re.I), "palatalization"),
    (re.compile(r"\b(want|got|need|have) to\b", re.I), "weak_form"),
    (re.compile(r"\b(an?|the|of|to|for|and|but|or|at|as)\b", re.I), "weak_form"),
]


def _load_phoneme_table() -> list[dict]:
    with open(_TABLE_PATH, encoding="utf-8") as f:
        return json.load(f)["phoneme_flags"]


_PHONEME_TABLE = None


def flag_item(text: str, ipa: str = "") -> list[str]:
    """Return a de-duplicated, order-preserving list of difficulty flags."""
    global _PHONEME_TABLE
    if _PHONEME_TABLE is None:
        _PHONEME_TABLE = _load_phoneme_table()

    flags: list[str] = []

    if ipa:
        for entry in _PHONEME_TABLE:
            if any(match in ipa for match in entry["ipa_matches"]):
                flags.append(entry["flag"])

    seen_reduction = False
    seen_weak_form = False
    for pattern, flag in _REDUCTION_PATTERNS:
        if not pattern.search(text):
            continue
        if flag == "weak_form":
            if seen_weak_form:
                continue
            seen_weak_form = True
        if flag == "reduction":
            seen_reduction = True
        if flag not in flags:
            flags.append(flag)

    return flags


def is_connected_speech_priority(flags: list[str]) -> bool:
    """AGENTS.md: sentences with connected-speech processes get prioritized
    as listening material."""
    return any(f in flags for f in ("weak_form", "contraction", "reduction", "palatalization"))
