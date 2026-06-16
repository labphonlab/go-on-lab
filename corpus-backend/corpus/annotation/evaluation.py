"""Corpus-level error-rate measurement via human-verified samples.

Auto-generated labels must be *measured*, not trusted. The workflow:

  1. Draw a sample of segments (uniformly or stratified by confidence band).
  2. Emit a review sheet a human fills in (see review_sheet.py).
  3. Ingest the corrections and compute WER + CER with a bootstrap confidence
     interval, broken down by confidence band so the auto-accept threshold can
     be set empirically.
  4. Publish the figures in the dataset card.

Publishing these is what makes an auto-labeled corpus citable and research-grade.
Pure standard library.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from .models import Segment


# --------------------------------------------------------------------------
# Edit-distance primitives
# --------------------------------------------------------------------------

def _edit_distance(ref: list, hyp: list) -> int:
    """Levenshtein distance between two token sequences."""
    if not ref:
        return len(hyp)
    prev = list(range(len(hyp) + 1))
    for i, rw in enumerate(ref, 1):
        cur = [i]
        for j, hw in enumerate(hyp, 1):
            cost = 0 if rw == hw else 1
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost))
        prev = cur
    return prev[-1]


def _wer(reference: str, hypothesis: str) -> tuple[int, int]:
    """Word edit distance -> (errors, reference_word_count)."""
    ref = reference.split()
    return (_edit_distance(ref, hypothesis.split()), len(ref))


def _cer(reference: str, hypothesis: str) -> tuple[int, int]:
    """Character edit distance -> (errors, reference_char_count).

    Whitespace is ignored so CER is robust for languages without word spacing
    (e.g. Japanese), where WER is unreliable.
    """
    ref = list("".join(reference.split()))
    hyp = list("".join(hypothesis.split()))
    return (_edit_distance(ref, hyp), len(ref))


# --------------------------------------------------------------------------
# Sampling
# --------------------------------------------------------------------------

def sample_for_review(segments: list[Segment], n: int,
                      seed: int = 0) -> list[Segment]:
    """Uniform random sample of segments to hand-verify."""
    rng = random.Random(seed)
    pool = list(segments)
    rng.shuffle(pool)
    return pool[:min(n, len(pool))]


def confidence_band(seg: Segment, edges=(0.5, 0.7, 0.9)) -> str:
    """Label a segment by its ASR confidence band (for stratification)."""
    c = None
    if seg.transcript is not None:
        c = seg.transcript.confidence
    if c is None:
        return "unknown"
    lo = 0.0
    for e in edges:
        if c < e:
            return f"[{lo:.1f},{e:.1f})"
        lo = e
    return f"[{lo:.1f},1.0]"


def stratified_sample(segments: list[Segment], n: int, seed: int = 0,
                      edges=(0.5, 0.7, 0.9)) -> list[Segment]:
    """Sample ~evenly across confidence bands so every band is verified.

    A uniform sample over-represents the dominant band; stratifying lets us
    measure error *per band* and choose the auto-accept threshold empirically.
    """
    rng = random.Random(seed)
    bands: dict[str, list[Segment]] = {}
    for s in segments:
        bands.setdefault(confidence_band(s, edges), []).append(s)
    if not bands:
        return []

    per_band = max(1, n // len(bands))
    out: list[Segment] = []
    for band in sorted(bands):
        pool = list(bands[band])
        rng.shuffle(pool)
        out.extend(pool[:per_band])
    # Top up to n with leftovers if rounding left us short.
    if len(out) < n:
        chosen = {s.segment_id for s in out}
        rest = [s for s in segments if s.segment_id not in chosen]
        rng.shuffle(rest)
        out.extend(rest[:n - len(out)])
    return out[:n]


# --------------------------------------------------------------------------
# Measurement
# --------------------------------------------------------------------------

@dataclass
class _Tally:
    errors: int = 0
    units: int = 0
    # per-segment (errors, units) retained so we can bootstrap a CI
    per_segment: list = field(default_factory=list)

    def add(self, err: int, units: int) -> None:
        self.errors += err
        self.units += units
        self.per_segment.append((err, units))

    @property
    def rate(self) -> float:
        return self.errors / self.units if self.units else 0.0


def _bootstrap_ci(per_segment: list[tuple[int, int]], iters: int = 1000,
                  alpha: float = 0.05, seed: int = 0) -> tuple[float, float]:
    """Bootstrap CI for a ratio metric by resampling segments with replacement."""
    if not per_segment:
        return (0.0, 0.0)
    rng = random.Random(seed)
    n = len(per_segment)
    rates = []
    for _ in range(iters):
        e = u = 0
        for _ in range(n):
            err, units = per_segment[rng.randrange(n)]
            e += err
            u += units
        rates.append(e / u if u else 0.0)
    rates.sort()
    lo = rates[int((alpha / 2) * iters)]
    hi = rates[min(iters - 1, int((1 - alpha / 2) * iters))]
    return (round(lo, 4), round(hi, 4))


@dataclass
class ErrorRateResult:
    n_segments: int
    wer: float
    cer: float
    wer_ci: tuple
    cer_ci: tuple
    total_word_errors: int
    total_words: int
    total_char_errors: int
    total_chars: int
    by_band: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "n_segments": self.n_segments,
            "wer": round(self.wer, 4),
            "wer_ci95": list(self.wer_ci),
            "cer": round(self.cer, 4),
            "cer_ci95": list(self.cer_ci),
            "total_word_errors": self.total_word_errors,
            "total_words": self.total_words,
            "total_char_errors": self.total_char_errors,
            "total_chars": self.total_chars,
            "by_band": self.by_band,
        }


def measure_error_rates(corrections: dict[str, str], segments: list[Segment],
                        edges=(0.5, 0.7, 0.9), seed: int = 0) -> ErrorRateResult:
    """Compute WER + CER (with 95% bootstrap CIs) from hand corrections.

    ``corrections`` maps segment_id -> the human reference transcript. Segments
    without a hypothesis transcript are skipped. Results are broken down by the
    segment's ASR confidence band.
    """
    by_id = {s.segment_id: s for s in segments}
    word = _Tally()
    char = _Tally()
    band_tallies: dict[str, tuple[_Tally, _Tally]] = {}

    for seg_id, reference in corrections.items():
        seg = by_id.get(seg_id)
        if seg is None or seg.transcript is None or seg.transcript.text is None:
            continue
        hyp = seg.transcript.text
        we, ww = _wer(reference, hyp)
        ce, cc = _cer(reference, hyp)
        word.add(we, ww)
        char.add(ce, cc)
        band = confidence_band(seg, edges)
        wt, ct = band_tallies.setdefault(band, (_Tally(), _Tally()))
        wt.add(we, ww)
        ct.add(ce, cc)

    by_band = {
        band: {
            "n": len(wt.per_segment),
            "wer": round(wt.rate, 4),
            "cer": round(ct.rate, 4),
            "words": wt.units,
            "chars": ct.units,
        }
        for band, (wt, ct) in sorted(band_tallies.items())
    }

    return ErrorRateResult(
        n_segments=len(word.per_segment),
        wer=word.rate, cer=char.rate,
        wer_ci=_bootstrap_ci(word.per_segment, seed=seed),
        cer_ci=_bootstrap_ci(char.per_segment, seed=seed),
        total_word_errors=word.errors, total_words=word.units,
        total_char_errors=char.errors, total_chars=char.units,
        by_band=by_band,
    )


# --- backwards-compatible thin wrapper (kept for existing callers) ---------

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
    """WER only (kept for compatibility; prefer measure_error_rates)."""
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
