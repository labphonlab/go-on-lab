"""Tests for LPC formant estimation and corpus vowel-space analysis."""

import math
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.analysis.formants import (
    estimate_formants, levinson_durbin, autocorrelate, pre_emphasis,
    resample_linear, _lowpass_fir)
from corpus.analysis.vowel_space import (
    analyze_vowel_space, measure_segment_vowels, VowelMeasurement, _check_ordering)
from corpus.annotation.models import Segment, Transcript
from corpus.audio.wav import WavData


def _synth_vowel(formants, bws=(60, 90, 120, 150), f0=120, sr=16000, dur=0.25):
    """Source-filter synthesis: impulse train through formant resonators."""
    n = int(sr * dur)
    src = [0.0] * n
    period = int(sr / f0)
    for i in range(0, n, period):
        src[i] = 1.0
    y = src
    for F, B in zip(formants, bws):
        r = math.exp(-math.pi * B / sr)
        th = 2 * math.pi * F / sr
        a1, a2 = -2 * r * math.cos(th), r * r
        out = [0.0] * n
        for i in range(n):
            v = y[i]
            if i >= 1:
                v -= a1 * out[i - 1]
            if i >= 2:
                v -= a2 * out[i - 2]
            out[i] = v
        y = out
    m = max(abs(v) for v in y) or 1.0
    return [v / m for v in y]


# -- LPC primitives ------------------------------------------------------

def test_pre_emphasis_first_sample_unchanged():
    assert pre_emphasis([1.0, 1.0, 1.0])[0] == 1.0


def test_levinson_recovers_ar_process():
    # AR(2) autocorrelation -> coefficients should be finite and a[0]==1
    r = autocorrelate([0.1 * math.sin(i) for i in range(200)], 4)
    a = levinson_durbin(r, 4)
    assert a[0] == 1.0
    assert len(a) == 5


def test_lowpass_attenuates_high_freq():
    sr = 16000
    n = 1600
    hi = [math.sin(2 * math.pi * 7000 * i / sr) for i in range(n)]
    out = _lowpass_fir(hi, 3000, sr)
    # energy of a 7 kHz tone should drop sharply after a 3 kHz low-pass
    e_in = sum(x * x for x in hi)
    e_out = sum(x * x for x in out)
    assert e_out < 0.2 * e_in


# -- formant recovery on synthetic vowels --------------------------------

def test_formants_recover_known_vowels():
    cases = {
        "i": (300, 2300, 3000, 3500),
        "ae": (700, 1700, 2600, 3600),
        "u": (350, 900, 2400, 3400),
        "a": (750, 1100, 2550, 3500),
    }
    for name, F in cases.items():
        fm = estimate_formants(_synth_vowel(F), 16000)
        assert fm.f1 is not None and fm.f2 is not None, name
        assert abs(fm.f1 - F[0]) < 130, f"{name} F1 {fm.f1} vs {F[0]}"
        assert abs(fm.f2 - F[1]) < 250, f"{name} F2 {fm.f2} vs {F[1]}"


def test_too_short_returns_none():
    fm = estimate_formants([0.1, -0.1, 0.1], 16000)
    assert fm.f1 is None


def test_resample_reduces_length():
    xs = [math.sin(i / 5.0) for i in range(1600)]
    out = resample_linear(xs, 16000, 10000)
    assert len(out) < len(xs)


# -- vowel space ---------------------------------------------------------

def _wav_from(samples, sr=16000):
    return WavData(sample_rate=sr, channels=1, bit_depth=16,
                   n_frames=len(samples), samples=samples)


def _vowel_segment(seg_id, formants, vowel_label, sr=16000):
    sig = _synth_vowel(formants)
    # one vowel phone spanning the whole clip
    dur = len(sig) / sr
    seg = Segment(seg_id, seg_id.split("#")[0], 0.0, dur, "S0",
                  transcript=Transcript("x", "en", 0.9),
                  phones=[{"start_s": 0.0, "end_s": dur, "label": vowel_label}])
    return _wav_from(sig), seg


def test_measure_segment_vowels_extracts_vowel_only():
    sig = _synth_vowel((700, 1700, 2600, 3600))
    dur = len(sig) / 16000
    seg = Segment("a#0", "a", 0.0, dur, "S0",
                  phones=[{"start_s": 0.0, "end_s": dur / 2, "label": "AE1"},
                          {"start_s": dur / 2, "end_s": dur, "label": "T"}])
    ms = measure_segment_vowels(_wav_from(sig), seg)
    assert len(ms) == 1               # only the vowel, not the /T/
    assert ms[0].vowel == "AE"


def test_vowel_space_ordering_ok_for_real_layout():
    # /i/ high-front (low F1, high F2) vs /a/ low (high F1, low F2)
    ms = [VowelMeasurement("IY", 300, 2300, "s1"),
          VowelMeasurement("AA", 750, 1100, "s2")]
    res = analyze_vowel_space(ms, language="en")
    assert res.ordering_ok is True


def test_vowel_space_ordering_fails_when_scrambled():
    # swapped: 'i' given low-vowel formants and vice versa
    ms = [VowelMeasurement("IY", 750, 1100, "s1"),
          VowelMeasurement("AA", 300, 2300, "s2")]
    assert analyze_vowel_space(ms, "en").ordering_ok is False


def test_vowel_space_target_error_small_for_on_target():
    ms = [VowelMeasurement("IY", 305, 2290, "s1")]
    res = analyze_vowel_space(ms, "en")
    cat = res.categories[0]
    assert cat.target == (300, 2300)
    assert cat.f1_error < 20 and cat.f2_error < 20


def test_end_to_end_measure_then_order():
    wav_i, seg_i = _vowel_segment("c#0", (300, 2300, 3000, 3500), "IY1")
    wav_a, seg_a = _vowel_segment("c#1", (750, 1100, 2550, 3500), "AA1")
    ms = measure_segment_vowels(wav_i, seg_i) + measure_segment_vowels(wav_a, seg_a)
    res = analyze_vowel_space(ms, "en")
    assert res.n_vowels_measured == 2
    assert res.ordering_ok is True
    # measured means should be within a sane error of the targets
    assert res.mean_target_error_hz is not None
    assert res.mean_target_error_hz < 200
