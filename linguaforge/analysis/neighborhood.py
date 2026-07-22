"""Phonological neighborhood density (ND) via CMUdict.

Replaces the earlier proxy in priority.py (which stood in for ND using
difficulty.py's L1-interference flags directly) with the real thing:

  - compute_nd(word, index): standard neighborhood density (Vitevitch &
    Luce) — the count of population words reachable from `word`'s CMUdict
    pronunciation by one phone substitution, insertion, or deletion.
  - compute_l1_weighted_nd(word, canonical_index): the same idea, but
    phones in the L1 merge-pairs table (data_tables/l1_interference_en_ja.json
    -- the same table difficulty.py's IPA-substring flags come from, just
    read here as ARPAbet pairs) are first collapsed to a shared symbol.
    A Japanese-confusable substitution then counts as a *closer* neighbor,
    including pairs that become phonologically IDENTICAL once collapsed
    (arguably the most confusable case there is, and not something plain
    edit-distance-1 neighborhoods can express at all).

Collapsing symbols before computing edit distance can only shrink or
preserve distances between any two sequences, never grow them -- so
nd_l1_weighted >= nd is a structural guarantee, not an empirical
tendency. See tests/test_neighborhood.py for the invariant test and a
worked example (very/belly: distance 2 normally, distance 0 once V/B and
R/L are merged, so "belly" is an L1-only neighbor of "very").

Population default: all ~126k CMUdict headwords -- CMUdict itself is a
Carnegie Mellon University resource under a permissive BSD-style license
(see cmudict.CMUDICT_LICENSE), not the NGSL wordlist AGENTS.md actually
asks for. See README's "NGSL 1.2" section for why that swap isn't done
yet in this environment.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

import cmudict

_L1_TABLE_PATH = Path(__file__).resolve().parent.parent / "data_tables" / "l1_interference_en_ja.json"
_STRESS_RE = re.compile(r"\d")


@lru_cache(maxsize=1)
def _alphabet() -> tuple[str, ...]:
    return tuple(phone for phone, _category in cmudict.phones())


@lru_cache(maxsize=1)
def _cmudict_entries() -> dict:
    return cmudict.dict()


def _strip_stress(phone: str) -> str:
    return _STRESS_RE.sub("", phone)


def get_pronunciation(word: str) -> tuple[str, ...] | None:
    """First CMUdict pronunciation for `word` (stress digits stripped), or
    None if the word isn't in CMUdict."""
    entries = _cmudict_entries().get(word.lower())
    if not entries:
        return None
    return tuple(_strip_stress(p) for p in entries[0])


@lru_cache(maxsize=1)
def _l1_merge_map() -> dict[str, str]:
    pairs = json.loads(_L1_TABLE_PATH.read_text(encoding="utf-8"))["arpabet_merge_pairs"]
    merge_map: dict[str, str] = {}
    for representative, other in pairs:
        merge_map[other] = representative
    return merge_map


def canonicalize(phones: tuple[str, ...]) -> tuple[str, ...]:
    """Collapse L1-confusable phones (L/R, B/V, S/TH, Z/DH, IH/IY, F/HH) to
    a shared representative symbol."""
    merge_map = _l1_merge_map()
    return tuple(merge_map.get(p, p) for p in phones)


class NeighborIndex:
    """A word population indexed by exact phone sequence, so looking up
    whether a candidate sequence exists in the population is an O(1) dict
    lookup rather than an O(population) scan."""

    def __init__(self, words: list[str], canonical: bool = False):
        self.canonical = canonical
        self.exact: dict[tuple[str, ...], set[str]] = {}
        for w in words:
            phones = get_pronunciation(w)
            if phones is None:
                continue
            key = canonicalize(phones) if canonical else phones
            self.exact.setdefault(key, set()).add(w.lower())

    def words_at(self, phones: tuple[str, ...]) -> set[str]:
        return self.exact.get(phones, set())


def _candidate_neighbors(phones: tuple[str, ...]) -> set[tuple[str, ...]]:
    """Every phone sequence reachable from `phones` by exactly one
    substitution, insertion, or deletion (never includes `phones` itself)."""
    alphabet = _alphabet()
    candidates: set[tuple[str, ...]] = set()
    n = len(phones)

    for i in range(n):
        for p in alphabet:
            if p != phones[i]:
                candidates.add(phones[:i] + (p,) + phones[i + 1 :])

    for i in range(n):
        candidates.add(phones[:i] + phones[i + 1 :])

    for i in range(n + 1):
        for p in alphabet:
            candidates.add(phones[:i] + (p,) + phones[i:])

    candidates.discard(phones)
    return candidates


def compute_nd(word: str, index: NeighborIndex) -> int | None:
    """Standard ND: distinct population words at edit-distance-1 from
    `word`'s pronunciation. None if `word` isn't in CMUdict."""
    phones = get_pronunciation(word)
    if phones is None:
        return None
    neighbor_words: set[str] = set()
    for candidate in _candidate_neighbors(phones):
        neighbor_words |= index.words_at(candidate)
    neighbor_words.discard(word.lower())
    return len(neighbor_words)


def compute_l1_weighted_nd(word: str, canonical_index: NeighborIndex) -> int | None:
    """L1-weighted ND over the same population, canonicalized. Always
    >= compute_nd for the same word/population (see module docstring)."""
    phones = get_pronunciation(word)
    if phones is None:
        return None
    canon = canonicalize(phones)

    neighbor_words: set[str] = set(canonical_index.words_at(canon))  # distance-0-after-merge
    for candidate in _candidate_neighbors(canon):
        neighbor_words |= canonical_index.words_at(candidate)
    neighbor_words.discard(word.lower())
    return len(neighbor_words)


@lru_cache(maxsize=1)
def default_population() -> tuple[str, ...]:
    """All CMUdict headwords — see module docstring re: NGSL vs CMUdict."""
    return tuple(_cmudict_entries().keys())


@lru_cache(maxsize=1)
def default_index() -> NeighborIndex:
    return NeighborIndex(list(default_population()), canonical=False)


@lru_cache(maxsize=1)
def default_canonical_index() -> NeighborIndex:
    return NeighborIndex(list(default_population()), canonical=True)


def score(word: str) -> tuple[int | None, int | None]:
    """Convenience: (nd, nd_l1_weighted) against the default CMUdict
    population. (None, None) if `word` isn't in CMUdict."""
    return compute_nd(word, default_index()), compute_l1_weighted_nd(word, default_canonical_index())
