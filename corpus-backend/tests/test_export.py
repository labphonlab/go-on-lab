"""Tests for the Praat / ELAN / Hugging Face exporters (all offline)."""

import json
import os
import sys
import tempfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.annotation.models import Segment, Transcript, WordTiming
from corpus.alignment.textgrid import TextGrid
from corpus.export.praat import textgrid_for_source, export_textgrids
from corpus.export.elan import export_eaf
from corpus.export.hf_datasets import export_hf
from corpus.export import export_all
from corpus.models import ItemState


def _seg(seg_id, start, end, speaker, text, words=None, phones=None, state=None):
    tr = Transcript(text=text, language="en", confidence=0.9,
                    words=[WordTiming(*w) for w in (words or [])])
    s = Segment(seg_id, seg_id.split("#")[0], start, end, speaker, transcript=tr,
                phones=phones or [])
    s.state = state or ItemState.ACCEPTED
    return s


def _corpus():
    return [
        _seg("rec1#0000", 0.0, 1.0, "SPEAKER_00", "hello world",
             words=[("hello", 0.0, 0.5, 0.95), ("world", 0.5, 1.0, 0.92)],
             phones=[{"start_s": 0.0, "end_s": 0.2, "label": "HH"},
                     {"start_s": 0.2, "end_s": 0.5, "label": "AH"}]),
        _seg("rec1#0001", 1.5, 2.5, "SPEAKER_01", "goodbye",
             words=[("goodbye", 1.5, 2.5, 0.88)]),
    ]


# -- Praat ---------------------------------------------------------------

def test_praat_textgrid_roundtrips_through_reader():
    tg_str = textgrid_for_source(_corpus())
    tg = TextGrid.parse(tg_str)
    names = [t.name for t in tg.tiers]
    assert names == ["utterance", "words", "phones"]
    # utterance tier has our two texts among its (gap-filled) intervals
    utt_texts = [iv.text for iv in tg.tier("utterance").intervals]
    assert "hello world" in utt_texts and "goodbye" in utt_texts


def test_praat_tiers_are_gap_filled_and_monotonic():
    tg = TextGrid.parse(textgrid_for_source(_corpus()))
    words = tg.tier("words").intervals
    # intervals must tile without overlap (each xmin >= previous xmax)
    for a, b in zip(words, words[1:]):
        assert b.xmin >= a.xmax - 1e-9


def test_export_textgrids_one_file_per_source():
    out = tempfile.mkdtemp()
    n = export_textgrids(_corpus(), out)
    assert n == 1
    assert os.path.exists(os.path.join(out, "rec1.TextGrid"))


def test_praat_escapes_quotes():
    segs = [_seg("r#0000", 0.0, 1.0, "S0", 'she said "hi"')]
    tg = TextGrid.parse(textgrid_for_source(segs))
    assert any('she said "hi"' == iv.text for iv in tg.tier("utterance").intervals)


# -- ELAN ----------------------------------------------------------------

def test_elan_is_valid_xml_with_speaker_tiers():
    out = tempfile.mkdtemp()
    n = export_eaf(_corpus(), out)
    assert n == 1
    tree = ET.parse(os.path.join(out, "rec1.eaf"))
    root = tree.getroot()
    assert root.tag == "ANNOTATION_DOCUMENT"
    tiers = {t.get("TIER_ID") for t in root.findall("TIER")}
    assert tiers == {"SPEAKER_00", "SPEAKER_01"}


def test_elan_time_slots_are_monotonic():
    out = tempfile.mkdtemp()
    export_eaf(_corpus(), out)
    root = ET.parse(os.path.join(out, "rec1.eaf")).getroot()
    values = [int(ts.get("TIME_VALUE"))
              for ts in root.find("TIME_ORDER").findall("TIME_SLOT")]
    assert values == sorted(values)


def test_elan_links_media_when_given():
    out = tempfile.mkdtemp()
    export_eaf(_corpus(), out, media_dir="/data/audio")
    root = ET.parse(os.path.join(out, "rec1.eaf")).getroot()
    md = root.find("HEADER/MEDIA_DESCRIPTOR")
    assert md is not None and md.get("MEDIA_URL").endswith("rec1.wav")


# -- Hugging Face --------------------------------------------------------

def test_hf_metadata_jsonl_schema():
    out = tempfile.mkdtemp()
    n = export_hf(_corpus(), out)
    assert n == 2
    rows = [json.loads(l) for l in
            open(os.path.join(out, "metadata.jsonl"), encoding="utf-8")]
    r = rows[0]
    assert r["file_name"].startswith("audio/")
    assert r["transcription"] == "hello world"
    assert r["is_machine_label"] is True
    assert r["n_words"] == 2 and r["n_phones"] == 2
    assert os.path.exists(os.path.join(out, "README.md"))


def test_hf_readme_has_language_frontmatter():
    out = tempfile.mkdtemp()
    export_hf(_corpus(), out)
    readme = open(os.path.join(out, "README.md"), encoding="utf-8").read()
    assert readme.startswith("---")
    assert "- en" in readme
    assert "audiofolder" in readme


def test_hf_accepted_only_filter():
    segs = _corpus()
    segs.append(_seg("rec1#0002", 3.0, 4.0, "S0", "rejected one",
                     state=ItemState.REJECTED))
    out = tempfile.mkdtemp()
    n = export_hf(segs, out, accepted_only=True)
    assert n == 2  # the rejected one is excluded


# -- export_all ----------------------------------------------------------

def test_export_all_writes_three_formats():
    out = tempfile.mkdtemp()
    counts = export_all(_corpus(), out, media_dir=os.path.join(out, "media"))
    assert counts == {"praat": 1, "elan": 1, "hf": 2}
    assert os.path.exists(os.path.join(out, "praat", "rec1.TextGrid"))
    assert os.path.exists(os.path.join(out, "elan", "rec1.eaf"))
    assert os.path.exists(os.path.join(out, "hf", "metadata.jsonl"))
