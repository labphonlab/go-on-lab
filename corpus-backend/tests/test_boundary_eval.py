"""Tests for forced-alignment boundary accuracy metrics."""

import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.alignment.textgrid import Interval, TextGrid
from corpus.alignment.boundary_eval import (
    boundary_errors, boundary_errors_from_textgrids, _align_labels, _median)


def _iv(a, b, t):
    return Interval(a, b, t)


def test_identical_alignment_is_zero_error():
    ref = [_iv(0.0, 0.2, "HH"), _iv(0.2, 0.5, "AH"), _iv(0.5, 0.8, "L")]
    res = boundary_errors(ref, list(ref))
    assert res.mean_abs_error == 0.0
    assert res.max_abs_error == 0.0
    assert res.within[0.01] == 1.0
    assert res.n_matched == 3


def test_uniform_shift_produces_expected_error():
    ref = [_iv(0.0, 0.2, "HH"), _iv(0.2, 0.5, "AH")]
    hyp = [_iv(0.03, 0.23, "HH"), _iv(0.23, 0.53, "AH")]  # +30 ms everywhere
    res = boundary_errors(ref, hyp)
    assert abs(res.mean_abs_error - 0.03) < 1e-9
    # 30 ms is outside 10/20 ms tolerance, inside 50 ms
    assert res.within[0.01] == 0.0
    assert res.within[0.02] == 0.0
    assert res.within[0.05] == 1.0


def test_tolerance_accuracy_mixed():
    ref = [_iv(0.0, 0.1, "A"), _iv(0.1, 0.2, "B")]
    # start boundaries: 0->0 (0ms), 0.1->0.115 (15ms); end: 0.1->0.1, 0.2->0.205
    hyp = [_iv(0.0, 0.1, "A"), _iv(0.115, 0.205, "B")]
    res = boundary_errors(ref, hyp)
    # within 20 ms: all four boundaries (0,0,15,5 ms) qualify
    assert res.within[0.02] == 1.0
    # within 10 ms: the 15 ms one fails -> 3/4
    assert abs(res.within[0.01] - 0.75) < 1e-9


def test_label_alignment_handles_insertion():
    ref = [_iv(0.0, 0.2, "A"), _iv(0.2, 0.4, "B")]
    hyp = [_iv(0.0, 0.1, "A"), _iv(0.1, 0.2, "X"), _iv(0.2, 0.4, "B")]  # extra X
    pairs = _align_labels(ref, hyp)
    # A and B match; X is an insertion and is not paired
    assert [(p.ref.text, p.hyp.text) for p in pairs] == [("A", "A"), ("B", "B")]


def test_label_alignment_handles_deletion():
    ref = [_iv(0.0, 0.2, "A"), _iv(0.2, 0.4, "B"), _iv(0.4, 0.6, "C")]
    hyp = [_iv(0.0, 0.2, "A"), _iv(0.2, 0.6, "C")]  # B deleted
    pairs = _align_labels(ref, hyp)
    assert [(p.ref.text, p.hyp.text) for p in pairs] == [("A", "A"), ("C", "C")]


def test_only_matched_pairs_contribute_errors():
    ref = [_iv(0.0, 0.2, "A"), _iv(0.2, 0.4, "B")]
    hyp = [_iv(0.0, 0.2, "A"), _iv(0.2, 0.3, "X"), _iv(0.3, 0.4, "B")]
    res = boundary_errors(ref, hyp)
    # A matches exactly; B's start differs (0.2 vs 0.3 = 100ms), end matches
    assert res.n_matched == 2
    assert abs(res.max_abs_error - 0.1) < 1e-9


def test_empty_intervals_are_skipped():
    ref = [_iv(0.0, 0.2, "A"), _iv(0.2, 0.5, ""), _iv(0.5, 0.7, "B")]
    hyp = [_iv(0.0, 0.2, "A"), _iv(0.5, 0.7, "B")]
    res = boundary_errors(ref, hyp)
    assert res.n_ref == 2 and res.n_hyp == 2     # empties dropped
    assert res.mean_abs_error == 0.0


def test_median_helper():
    assert _median([]) == 0.0
    assert _median([5.0]) == 5.0
    assert _median([1.0, 3.0]) == 2.0
    assert _median([1.0, 2.0, 100.0]) == 2.0


def test_as_dict_reports_milliseconds():
    ref = [_iv(0.0, 0.2, "A")]
    hyp = [_iv(0.03, 0.2, "A")]   # 30 ms start error, 0 end error
    d = boundary_errors(ref, hyp).as_dict()
    assert d["mean_abs_error_ms"] == 15.0   # (30 + 0) / 2
    assert "10ms" in d["within"] and "50ms" in d["within"]


def test_from_textgrids_roundtrip():
    from corpus.export.praat import textgrid_for_source
    # Build two TextGrids via the writer and compare a tier.
    tg = """File type = "ooTextFile"
Object class = "TextGrid"

xmin = 0
xmax = 0.6
tiers? <exists>
size = 1
item []:
    item [1]:
        class = "IntervalTier"
        name = "phones"
        xmin = 0
        xmax = 0.6
        intervals: size = 2
        intervals [1]:
            xmin = 0.0
            xmax = 0.3
            text = "A"
        intervals [2]:
            xmin = 0.3
            xmax = 0.6
            text = "B"
"""
    d = tempfile.mkdtemp()
    ref_p = os.path.join(d, "ref.TextGrid")
    hyp_p = os.path.join(d, "hyp.TextGrid")
    open(ref_p, "w", encoding="utf-8").write(tg)
    open(hyp_p, "w", encoding="utf-8").write(tg.replace("0.3", "0.32"))  # 20ms
    res = boundary_errors_from_textgrids(ref_p, hyp_p, tier="phones")
    assert res.n_matched == 2
    assert res.max_abs_error > 0
