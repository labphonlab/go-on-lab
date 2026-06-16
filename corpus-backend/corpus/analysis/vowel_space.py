"""Corpus-level vowel-space analysis — the gold standard of phonetic validation.

For every vowel phone in the corpus that has a time interval and audio, we
measure F1/F2 at the vowel's steady state, then aggregate per vowel category. A
corpus is *phonetically plausible* when:

  * each vowel category's mean F1/F2 lands near its known target, and
  * the categories are correctly ordered in the vowel space
    (e.g. /i/ has lower F1 and higher F2 than /a/).

If the vowel space is collapsed or scrambled, then the audio, the vowel labels
or the alignment are wrong — a deep validation that the cheaper duration check
(profile.py) cannot provide.

Formant extraction is pure-Python LPC (see formants.py); this module just maps
phones -> measurements -> per-category aggregates and a health verdict.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from ..annotation.models import Segment
from ..audio.wav import WavData
from . import phones as ph
from .formants import estimate_formants, window_for_interval
from .stats import summarise


# Canonical adult formant targets (Hz), rough values for sanity-checking only.
# ARPAbet keys (stress stripped). Sources: Hillenbrand et al. 1995 (EN),
# common JA five-vowel references. These are *targets to compare against*, not
# ground truth for measurement.
VOWEL_TARGETS_EN = {
    "IY": (300, 2300), "IH": (430, 2000), "EH": (580, 1800), "AE": (700, 1700),
    "AH": (700, 1300), "AA": (750, 1100), "AO": (600, 900), "UH": (450, 1100),
    "UW": (350, 900), "ER": (500, 1400),
}
# Japanese 5-vowel system (a i u e o), IPA single-char keys.
VOWEL_TARGETS_JA = {
    "i": (300, 2200), "e": (450, 1900), "a": (800, 1300),
    "o": (500, 900), "u": (350, 1200),
}


@dataclass
class VowelMeasurement:
    vowel: str
    f1: float
    f2: float
    segment_id: str


@dataclass
class VowelCategory:
    vowel: str
    n: int
    f1: dict           # Summary.as_dict()
    f2: dict
    target: tuple | None = None
    f1_error: float | None = None   # |mean - target|
    f2_error: float | None = None

    def as_dict(self) -> dict:
        return {"vowel": self.vowel, "n": self.n,
                "f1_mean": self.f1["mean"], "f2_mean": self.f2["mean"],
                "f1": self.f1, "f2": self.f2,
                "target": list(self.target) if self.target else None,
                "f1_error": (None if self.f1_error is None else round(self.f1_error, 1)),
                "f2_error": (None if self.f2_error is None else round(self.f2_error, 1))}


@dataclass
class VowelSpaceResult:
    n_vowels_measured: int
    categories: list           # list[VowelCategory]
    ordering_ok: bool | None   # is /i/-/a/ contrast in the right direction?
    mean_target_error_hz: float | None
    detail: str = ""

    def as_dict(self) -> dict:
        return {
            "n_vowels_measured": self.n_vowels_measured,
            "categories": [c.as_dict() for c in self.categories],
            "ordering_ok": self.ordering_ok,
            "mean_target_error_hz": (None if self.mean_target_error_hz is None
                                     else round(self.mean_target_error_hz, 1)),
            "detail": self.detail,
        }


def measure_segment_vowels(wav: WavData, seg: Segment) -> list[VowelMeasurement]:
    """Measure F1/F2 for each vowel phone in one segment."""
    out: list[VowelMeasurement] = []
    for p in seg.phones:
        label = p.get("label", "")
        if not ph.is_vowel(label):
            continue
        start = float(p.get("start_s", 0.0))
        end = float(p.get("end_s", 0.0))
        window = window_for_interval(wav.samples, wav.sample_rate, start, end)
        fm = estimate_formants(window, wav.sample_rate)
        if fm.f1 is not None and fm.f2 is not None:
            out.append(VowelMeasurement(ph.normalise(label) or label.strip(),
                                        fm.f1, fm.f2, seg.segment_id))
    return out


def _targets_for(language: str | None) -> dict:
    if language and language.startswith("ja"):
        return VOWEL_TARGETS_JA
    return VOWEL_TARGETS_EN


def analyze_vowel_space(measurements: list[VowelMeasurement],
                        language: str | None = "en") -> VowelSpaceResult:
    """Aggregate per-vowel measurements into categories + a health verdict."""
    targets = _targets_for(language)
    by_vowel: dict[str, list[VowelMeasurement]] = defaultdict(list)
    for m in measurements:
        by_vowel[m.vowel].append(m)

    categories: list[VowelCategory] = []
    errors: list[float] = []
    for vowel, ms in sorted(by_vowel.items()):
        f1s = [m.f1 for m in ms]
        f2s = [m.f2 for m in ms]
        f1_summ = summarise(f1s).as_dict()
        f2_summ = summarise(f2s).as_dict()
        target = targets.get(vowel) or targets.get(vowel.lower())
        f1_err = f2_err = None
        if target:
            f1_err = abs(f1_summ["mean"] - target[0])
            f2_err = abs(f2_summ["mean"] - target[1])
            errors.extend([f1_err, f2_err])
        categories.append(VowelCategory(vowel, len(ms), f1_summ, f2_summ,
                                        target, f1_err, f2_err))

    # Ordering check: the canonical contrast /i/ (or IY) vs /a/ (AA/AH).
    ordering_ok = _check_ordering(by_vowel)

    mean_err = (sum(errors) / len(errors)) if errors else None
    return VowelSpaceResult(
        n_vowels_measured=len(measurements),
        categories=categories,
        ordering_ok=ordering_ok,
        mean_target_error_hz=mean_err,
    )


def _mean(vals: list[float]) -> float | None:
    return sum(vals) / len(vals) if vals else None


def _check_ordering(by_vowel: dict) -> bool | None:
    """Is the front high vowel (/i/, IY) lower-F1 and higher-F2 than the low
    vowel (/a/, AA/AH)? The defining axis of any vowel space."""
    def grab(keys):
        for k in keys:
            if k in by_vowel and by_vowel[k]:
                return by_vowel[k]
        return None

    high_front = grab(["IY", "i", "IH"])
    low = grab(["AA", "a", "AH", "AE"])
    if not high_front or not low:
        return None
    hf_f1 = _mean([m.f1 for m in high_front])
    hf_f2 = _mean([m.f2 for m in high_front])
    lo_f1 = _mean([m.f1 for m in low])
    lo_f2 = _mean([m.f2 for m in low])
    return (hf_f1 < lo_f1) and (hf_f2 > lo_f2)
