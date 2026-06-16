"""Tiny descriptive-statistics helpers (no numpy).

Just enough to summarise distributions for the corpus profile: quantiles, a
histogram, and a simple outlier count. Pure standard library.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


def _quantile(sorted_xs: list[float], q: float) -> float:
    if not sorted_xs:
        return 0.0
    if len(sorted_xs) == 1:
        return sorted_xs[0]
    pos = q * (len(sorted_xs) - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return sorted_xs[lo]
    frac = pos - lo
    return sorted_xs[lo] * (1 - frac) + sorted_xs[hi] * frac


@dataclass
class Summary:
    n: int
    mean: float
    std: float
    min: float
    p25: float
    median: float
    p75: float
    p95: float
    max: float

    def as_dict(self) -> dict:
        r = lambda x: round(x, 4)  # noqa: E731
        return {"n": self.n, "mean": r(self.mean), "std": r(self.std),
                "min": r(self.min), "p25": r(self.p25), "median": r(self.median),
                "p75": r(self.p75), "p95": r(self.p95), "max": r(self.max)}


def summarise(xs: list[float]) -> Summary:
    if not xs:
        return Summary(0, 0, 0, 0, 0, 0, 0, 0, 0)
    s = sorted(xs)
    n = len(s)
    mean = sum(s) / n
    var = sum((x - mean) ** 2 for x in s) / n
    return Summary(
        n=n, mean=mean, std=math.sqrt(var), min=s[0],
        p25=_quantile(s, 0.25), median=_quantile(s, 0.5),
        p75=_quantile(s, 0.75), p95=_quantile(s, 0.95), max=s[-1],
    )


def histogram(xs: list[float], bins: int = 10,
              lo: float | None = None, hi: float | None = None) -> list[dict]:
    """Equal-width histogram as a list of {lo, hi, count} buckets."""
    if not xs:
        return []
    lo = min(xs) if lo is None else lo
    hi = max(xs) if hi is None else hi
    if hi <= lo:
        return [{"lo": round(lo, 4), "hi": round(hi, 4), "count": len(xs)}]
    width = (hi - lo) / bins
    counts = [0] * bins
    for x in xs:
        idx = int((x - lo) / width)
        if idx == bins:           # the maximum lands in the last bucket
            idx = bins - 1
        if 0 <= idx < bins:
            counts[idx] += 1
    return [{"lo": round(lo + i * width, 4),
             "hi": round(lo + (i + 1) * width, 4), "count": c}
            for i, c in enumerate(counts)]


def outlier_fraction(xs: list[float], lo: float, hi: float) -> float:
    """Fraction of values outside the [lo, hi] plausibility window."""
    if not xs:
        return 0.0
    bad = sum(1 for x in xs if x < lo or x > hi)
    return bad / len(xs)
