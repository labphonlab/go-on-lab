"""Tests for corpus profiling: phone classes, stats, and health flags."""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.analysis import phones as ph
from corpus.analysis.stats import summarise, histogram, outlier_fraction
from corpus.analysis.profile import profile_corpus, render_markdown
from corpus.annotation.models import Segment, Transcript


# -- phone classification ------------------------------------------------

def test_arpabet_classification_strips_stress():
    assert ph.phone_class("AA1") == "vowel"
    assert ph.phone_class("IY0") == "vowel"
    assert ph.phone_class("P") == "plosive"
    assert ph.phone_class("SH") == "fricative"
    assert ph.phone_class("M") == "nasal"
    assert ph.phone_class("CH") == "affricate"


def test_ipa_classification():
    assert ph.phone_class("a") == "vowel"
    assert ph.phone_class("i") == "vowel"
    assert ph.phone_class("p") == "plosive"
    assert ph.phone_class("ʃ") == "fricative"


def test_non_speech_symbols():
    assert ph.phone_class("sil") == "non_speech"
    assert ph.phone_class("spn") == "non_speech"
    assert not ph.is_phone("")
    assert ph.is_phone("AA1")


# -- stats ---------------------------------------------------------------

def test_summarise_basic():
    s = summarise([1.0, 2.0, 3.0, 4.0, 5.0])
    assert s.n == 5
    assert s.median == 3.0
    assert s.min == 1.0 and s.max == 5.0


def test_histogram_buckets_sum_to_n():
    h = histogram([0.1, 0.2, 0.9, 0.5, 0.5], bins=5)
    assert sum(b["count"] for b in h) == 5


def test_outlier_fraction():
    assert outlier_fraction([1, 2, 3, 100], 0, 10) == 0.25


# -- profiler helpers ----------------------------------------------------

def _seg(seg_id, text, dur=2.0, speaker="S0", lang="en", conf=0.9, phones=None):
    tr = Transcript(text=text, language=lang, confidence=conf)
    return Segment(seg_id, seg_id.split("#")[0], 0.0, dur, speaker,
                   transcript=tr, phones=phones or [],
                   scores={"snr_db": 25.0})


def _phones(spec):
    """spec: list of (label, duration_s) -> contiguous phone dicts."""
    out, t = [], 0.0
    for label, d in spec:
        out.append({"start_s": t, "end_s": t + d, "label": label})
        t += d
    return out


# -- coverage / balance --------------------------------------------------

def test_speaker_imbalance_flagged():
    segs = [_seg(f"a#{i}", "hello world", dur=10.0, speaker="S0") for i in range(9)]
    segs.append(_seg("a#9", "hi", dur=1.0, speaker="S1"))
    prof = profile_corpus(segs)
    assert prof.coverage["speakers"] == 2
    assert any(f.code == "speaker_imbalance" for f in prof.flags)


def test_template_contamination_flagged():
    segs = [_seg(f"a#{i}", "the same sentence", speaker=f"S{i%3}")
            for i in range(10)]
    prof = profile_corpus(segs)
    assert any(f.code == "template_contamination" for f in prof.flags)
    assert prof.labels["duplicate_transcripts"][0]["count"] == 10


def test_empty_transcript_rate_flagged():
    segs = [_seg(f"a#{i}", None) for i in range(7)] + \
           [_seg(f"b#{i}", "real text") for i in range(3)]
    prof = profile_corpus(segs)
    assert prof.labels["empty_transcript_rate"] == 0.7
    assert any(f.code == "high_empty_rate" for f in prof.flags)


# -- the gold-free alignment checks --------------------------------------

def test_healthy_phone_durations_no_flags():
    # vowels longer than plosives, none sub-10ms -> clean
    phones = _phones([("P", 0.04), ("AA1", 0.12), ("T", 0.05), ("IY0", 0.10)])
    segs = [_seg(f"a#{i}", "pat tea", phones=phones) for i in range(3)]
    prof = profile_corpus(segs)
    assert prof.phonetics["vowel_longer_than_plosive"] is True
    assert prof.phonetics["sub_10ms_fraction"] == 0.0
    assert not any(f.level == "error" for f in prof.flags)


def test_vowel_not_longer_than_plosive_is_error():
    # pathological: vowels SHORTER than plosives -> alignment suspect
    phones = _phones([("P", 0.15), ("AA1", 0.03), ("T", 0.14), ("IY0", 0.02)])
    segs = [_seg(f"a#{i}", "pat tea", phones=phones) for i in range(3)]
    prof = profile_corpus(segs)
    assert prof.phonetics["vowel_longer_than_plosive"] is False
    assert any(f.code == "vowel_not_longer_than_plosive" and f.level == "error"
               for f in prof.flags)


def test_degenerate_sub10ms_durations_is_error():
    # most phones collapsed to ~1 ms -> broken alignment
    phones = _phones([("P", 0.001), ("AA1", 0.001), ("T", 0.001), ("IY0", 0.2)])
    segs = [_seg(f"a#{i}", "pat tea", phones=phones) for i in range(3)]
    prof = profile_corpus(segs)
    assert prof.phonetics["sub_10ms_fraction"] > 0.1
    assert any(f.code == "degenerate_phone_durations" for f in prof.flags)


def test_no_phones_means_no_phonetic_flags():
    segs = [_seg(f"a#{i}", "hello world", speaker=f"S{i}") for i in range(4)]
    prof = profile_corpus(segs)
    assert prof.phonetics["has_phone_alignment"] is False
    assert not any(f.code.startswith("vowel") or f.code == "degenerate_phone_durations"
                   for f in prof.flags)


def test_render_markdown_contains_sections():
    phones = _phones([("P", 0.04), ("AA1", 0.12)])
    segs = [_seg("a#0", "pa", phones=phones)]
    md = render_markdown(profile_corpus(segs))
    assert "Corpus Profile" in md
    assert "Health flags" in md
    assert "Phonetics" in md
