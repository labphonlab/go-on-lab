"""Corpus-level error-rate measurement via human-verified samples.

Auto-generated labels must be measured, not trusted. Hand-correct a random
sample of segments, then compute WER (words) and, if phone alignments exist,
mean boundary error. Publishing these in the dataset card is what makes the
corpus citable and research-grade.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from .models import Segment


def _wer(reference: str, hypothesis: str) -> tuple[int, int]:
    """Levenshtein word edit distance -> (errors, reference_word_count)."""
    ref = reference.split()
    hyp = hypothesis.split()
    if not ref:
        return (len(hyp), 0)
    prev = list(range(len(hyp) + 1))
    for i, rw in enumerate(ref, 1):
        cur = [i]
        for j, hw in enumerate(hyp, 1):
            cost = 0 if rw == hw else 1
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost))
        prev = cur
    return (prev[-1], len(ref))


def sample_for_review(segments: list[Segment], n: int,
                      seed: int = 0) -> list[Segment]:
    """Random sample of segments to hand-verify for error-rate estimation."""
    rng = random.Random(seed)
    pool = list(segments)
    rng.shuffle(pool)
    return pool[:min(n, len(pool))]


@dataclass
class WERResult:
    n_segments: int
    total_errors: int
    total_words: int

    @property
    def wer(self) -> float:
        return self.total_errors / self.total_words if self.total_words else 0.0

    def as_dict(self) -> dict:
        return {
            "n_segments": self.n_segments,
            "total_errors": self.total_errors,
            "total_words": self.total_words,
            "wer": round(self.wer, 4),
        }


def measure_wer(corrections: dict[str, str], segments: list[Segment]) -> WERResult:
    """Compare hand corrections {segment_id: reference} against ASR hypotheses."""
    by_id = {s.segment_id: s for s in segments}
    tot_err = tot_words = n = 0
    for seg_id, reference in corrections.items():
        seg = by_id.get(seg_id)
        if seg is None or seg.transcript is None or seg.transcript.text is None:
            continue
        err, words = _wer(reference, seg.transcript.text)
        tot_err += err
        tot_words += words
        n += 1
    return WERResult(n_segments=n, total_errors=tot_err, total_words=tot_words)
