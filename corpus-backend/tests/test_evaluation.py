"""Tests for WER/CER measurement, stratified sampling and the review sheet."""

import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.annotation.models import Segment, Transcript
from corpus.annotation.evaluation import (
    _wer, _cer, confidence_band, stratified_sample, sample_for_review,
    measure_error_rates, _bootstrap_ci)
from corpus.annotation.review_sheet import (
    write_review_sheet, read_corrections, review_progress)


def _seg(seg_id, text, conf=None):
    return Segment(seg_id, seg_id.split("#")[0], 0.0, 1.0, "S0",
                   transcript=Transcript(text=text, language="en", confidence=conf))


# -- edit distances ------------------------------------------------------

def test_wer_counts_word_errors():
    assert _wer("the quick brown fox", "the quick brown fox") == (0, 4)
    assert _wer("the quick brown fox", "the quick green fox") == (1, 4)


def test_cer_ignores_whitespace_and_counts_chars():
    # one substituted char out of 9 ref chars ("quickbrown" vs ...)
    err, n = _cer("ab cd", "ab ce")
    assert n == 4 and err == 1


def test_cer_robust_for_japanese_no_spaces():
    err, n = _cer("これはテスト", "これはテストだ")  # one extra char
    assert n == 6 and err == 1


# -- sampling ------------------------------------------------------------

def test_confidence_band_labels():
    assert confidence_band(_seg("a#0", "x", 0.95)) == "[0.9,1.0]"
    assert confidence_band(_seg("a#1", "x", 0.6)) == "[0.5,0.7)"
    assert confidence_band(_seg("a#2", "x", None)) == "unknown"


def test_stratified_sample_covers_bands():
    segs = ([_seg(f"hi#{i}", "x", 0.95) for i in range(20)] +
            [_seg(f"lo#{i}", "x", 0.55) for i in range(4)])
    picked = stratified_sample(segs, n=8, seed=1)
    bands = {confidence_band(s) for s in picked}
    # the rare low band must be represented, not drowned out
    assert "[0.5,0.7)" in bands
    assert "[0.9,1.0]" in bands


def test_uniform_sample_is_deterministic():
    segs = [_seg(f"a#{i}", "x", 0.9) for i in range(10)]
    assert ([s.segment_id for s in sample_for_review(segs, 3, seed=7)] ==
            [s.segment_id for s in sample_for_review(segs, 3, seed=7)])


# -- measurement ---------------------------------------------------------

def test_measure_error_rates_wer_and_cer():
    segs = [_seg("a#0", "the quick brown fox", 0.95),
            _seg("a#1", "hello world", 0.6)]
    corrections = {"a#0": "the quick brown ox",   # 1 word, some char errors
                   "a#1": "hello world"}          # perfect
    res = measure_error_rates(corrections, segs)
    assert res.n_segments == 2
    assert res.total_words == 6                    # 4 + 2 ref words
    assert res.total_word_errors == 1
    assert abs(res.wer - 1 / 6) < 1e-9
    assert res.cer > 0                             # "fox" vs "ox" -> char errors
    assert len(res.wer_ci) == 2


def test_measure_breaks_down_by_band():
    segs = [_seg("a#0", "alpha beta", 0.95),
            _seg("a#1", "gamma delta", 0.55)]
    res = measure_error_rates({"a#0": "alpha beta",        # perfect, high band
                               "a#1": "gamma epsilon"},    # 1 err, low band
                              segs)
    assert res.by_band["[0.9,1.0]"]["wer"] == 0.0
    assert res.by_band["[0.5,0.7)"]["wer"] == 0.5


def test_bootstrap_ci_brackets_point_estimate():
    per_seg = [(1, 4), (0, 3), (2, 5), (0, 2)]
    lo, hi = _bootstrap_ci(per_seg, iters=500, seed=3)
    point = sum(e for e, _ in per_seg) / sum(u for _, u in per_seg)
    assert lo <= point <= hi


# -- review sheet round-trip --------------------------------------------

def test_review_sheet_roundtrip_ok_and_corrected():
    segs = [_seg("a#0", "the quick brown fox", 0.9),
            _seg("a#1", "helo wrld", 0.4),
            _seg("a#2", "unreviewed line", 0.8)]
    path = os.path.join(tempfile.mkdtemp(), "sheet.csv")
    assert write_review_sheet(segs, path) == 3

    # Simulate a human filling the sheet: mark #0 ok, correct #1, leave #2.
    rows = open(path, encoding="utf-8").read().splitlines()
    header = rows[0].split(",")
    ok_i = header.index("ok")
    corr_i = header.index("corrected_transcript")
    import csv, io
    reader = list(csv.reader(io.StringIO("\n".join(rows))))
    for r in reader[1:]:
        if r[0] == "a#0":
            r[ok_i] = "x"
        elif r[0] == "a#1":
            r[corr_i] = "hello world"
    out = io.StringIO()
    csv.writer(out).writerows(reader)
    open(path, "w", encoding="utf-8").write(out.getvalue())

    corrections = read_corrections(path)
    assert corrections["a#0"] == "the quick brown fox"   # ok -> ASR text
    assert corrections["a#1"] == "hello world"           # corrected text
    assert "a#2" not in corrections                      # unreviewed skipped


def test_review_progress_tracks_completion():
    segs = [_seg(f"a#{i}", "x", 0.9) for i in range(4)]
    path = os.path.join(tempfile.mkdtemp(), "s.csv")
    write_review_sheet(segs, path)
    prog = review_progress(path)
    assert prog == {"total": 4, "reviewed": 0, "remaining": 4, "fraction": 0.0}


def test_measure_after_roundtrip_is_consistent():
    segs = [_seg("a#0", "alpha beta gamma", 0.9)]
    path = os.path.join(tempfile.mkdtemp(), "s.csv")
    write_review_sheet(segs, path)
    # mark ok via direct rewrite
    text = open(path, encoding="utf-8").read().replace(
        "alpha beta gamma,,", "alpha beta gamma,x,")
    open(path, "w", encoding="utf-8").write(text)
    corr = read_corrections(path)
    res = measure_error_rates(corr, segs)
    assert res.wer == 0.0 and res.cer == 0.0
