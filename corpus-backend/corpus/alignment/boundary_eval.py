"""Forced-alignment boundary accuracy: how good are the *times*, not the labels.

WER/CER score what was said; this scores *when* it was said — the boundary
placement that phonetic research depends on. Given a reference alignment (a
hand-corrected or gold TextGrid) and a hypothesis alignment (our aligner's
output), we report the standard metrics:

  * mean / median absolute boundary error (seconds)
  * tolerance accuracy: fraction of boundaries within 10 / 20 / 50 ms

Boundaries are matched by aligning the two label sequences (Levenshtein), so the
comparison is robust even when the aligner inserts/deletes a unit. Only
substitutions/matches contribute boundary errors; insertions and deletions are
counted separately. Pure standard library.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .textgrid import TextGrid, Interval


@dataclass
class _Pair:
    """A matched reference/hypothesis interval (by label-sequence alignment)."""

    ref: Interval
    hyp: Interval

    def start_error(self) -> float:
        return abs(self.ref.xmin - self.hyp.xmin)

    def end_error(self) -> float:
        return abs(self.ref.xmax - self.hyp.xmax)


def _align_labels(ref: list[Interval], hyp: list[Interval]) -> list[_Pair]:
    """Levenshtein-align two interval sequences by label; return matched pairs.

    Backtraces the edit-distance DP and keeps only aligned (match/substitution)
    positions, where a boundary comparison is meaningful.
    """
    n, m = len(ref), len(hyp)
    # DP cost table.
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        d[i][0] = i
    for j in range(1, m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref[i - 1].text == hyp[j - 1].text else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)

    # Backtrace, collecting aligned positions (diagonal moves).
    pairs: list[_Pair] = []
    i, j = n, m
    while i > 0 and j > 0:
        cost = 0 if ref[i - 1].text == hyp[j - 1].text else 1
        if d[i][j] == d[i - 1][j - 1] + cost:
            pairs.append(_Pair(ref[i - 1], hyp[j - 1]))
            i -= 1
            j -= 1
        elif d[i][j] == d[i - 1][j] + 1:
            i -= 1            # deletion (ref unit with no hyp match)
        else:
            j -= 1            # insertion (hyp unit with no ref match)
    pairs.reverse()
    return pairs


@dataclass
class BoundaryResult:
    n_boundaries: int
    n_ref: int
    n_hyp: int
    n_matched: int
    mean_abs_error: float
    median_abs_error: float
    max_abs_error: float
    within: dict = field(default_factory=dict)  # tolerance_s -> fraction

    def as_dict(self) -> dict:
        return {
            "n_boundaries": self.n_boundaries,
            "n_ref": self.n_ref,
            "n_hyp": self.n_hyp,
            "n_matched": self.n_matched,
            "mean_abs_error_ms": round(self.mean_abs_error * 1000, 2),
            "median_abs_error_ms": round(self.median_abs_error * 1000, 2),
            "max_abs_error_ms": round(self.max_abs_error * 1000, 2),
            "within": {f"{int(t*1000)}ms": round(f, 4)
                       for t, f in self.within.items()},
        }


def _median(xs: list[float]) -> float:
    if not xs:
        return 0.0
    s = sorted(xs)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2.0


def boundary_errors(ref_intervals: list[Interval], hyp_intervals: list[Interval],
                    tolerances=(0.01, 0.02, 0.05),
                    skip_empty: bool = True) -> BoundaryResult:
    """Compare hypothesis boundaries to reference for one tier.

    For each matched interval pair we score both its start and end boundary
    (shared boundaries are effectively double-counted across neighbours, which
    matches common forced-alignment evaluation practice). ``tolerances`` are in
    seconds.
    """
    if skip_empty:
        ref_intervals = [iv for iv in ref_intervals if iv.text.strip()]
        hyp_intervals = [iv for iv in hyp_intervals if iv.text.strip()]

    pairs = _align_labels(ref_intervals, hyp_intervals)
    errors: list[float] = []
    for p in pairs:
        errors.append(p.start_error())
        errors.append(p.end_error())

    within = {}
    for t in tolerances:
        within[t] = (sum(1 for e in errors if e <= t) / len(errors)
                     if errors else 0.0)

    return BoundaryResult(
        n_boundaries=len(errors),
        n_ref=len(ref_intervals), n_hyp=len(hyp_intervals),
        n_matched=len(pairs),
        mean_abs_error=(sum(errors) / len(errors)) if errors else 0.0,
        median_abs_error=_median(errors),
        max_abs_error=max(errors) if errors else 0.0,
        within=within,
    )


def boundary_errors_from_textgrids(ref_path: str, hyp_path: str,
                                   tier: str = "phones",
                                   tolerances=(0.01, 0.02, 0.05)) -> BoundaryResult:
    """Load two TextGrids and compare the named tier's boundaries."""
    ref_tg = TextGrid.parse_file(ref_path)
    hyp_tg = TextGrid.parse_file(hyp_path)
    ref_tier = ref_tg.tier(tier) or (ref_tg.tiers[-1] if ref_tg.tiers else None)
    hyp_tier = hyp_tg.tier(tier) or (hyp_tg.tiers[-1] if hyp_tg.tiers else None)
    ref_iv = ref_tier.intervals if ref_tier else []
    hyp_iv = hyp_tier.intervals if hyp_tier else []
    return boundary_errors(ref_iv, hyp_iv, tolerances)
