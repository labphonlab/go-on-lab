"""Tests for SVG plot, quality report, end-to-end orchestrator, VoxPopuli."""

import io
import os
import sys
import tarfile
import tempfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.analysis.vowel_space import VowelMeasurement, analyze_vowel_space
from corpus.analysis.plot import vowel_space_svg, write_vowel_space_svg
from corpus.analysis.profile import profile_corpus
from corpus.analysis.report import QualityReport, render_report
from corpus.annotation.models import Segment, Transcript
from corpus.audio.synth import write_segmented_wav
from corpus.models import ItemState
from corpus.orchestrate import run_corpus


# -- SVG plot ------------------------------------------------------------

def _vspace():
    ms = [VowelMeasurement("IY", 300, 2300, "s1"),
          VowelMeasurement("AA", 750, 1100, "s2"),
          VowelMeasurement("UW", 350, 900, "s3")]
    return analyze_vowel_space(ms, "en")


def test_svg_is_well_formed_xml():
    svg = vowel_space_svg(_vspace())
    root = ET.fromstring(svg)
    assert root.tag.endswith("svg")


def test_svg_contains_vowel_labels():
    svg = vowel_space_svg(_vspace())
    assert ">IY<" in svg and ">AA<" in svg


def test_write_svg_file():
    path = os.path.join(tempfile.mkdtemp(), "v.svg")
    write_vowel_space_svg(_vspace(), path)
    assert os.path.getsize(path) > 0


def test_svg_escapes_title():
    svg = vowel_space_svg(_vspace(), title="A & B <x>")
    assert "&amp;" in svg and "&lt;" in svg


# -- quality report ------------------------------------------------------

def _seg(seg_id, text, phones=None, conf=0.9, speaker="S0"):
    return Segment(seg_id, seg_id.split("#")[0], 0.0, 2.0, speaker,
                   transcript=Transcript(text, "en", conf),
                   phones=phones or [], scores={"snr_db": 25.0})


def test_report_ready_when_clean():
    phones = [{"start_s": 0.0, "end_s": 0.04, "label": "P"},
              {"start_s": 0.04, "end_s": 0.16, "label": "AA1"}]
    segs = [_seg(f"a#{i}", f"sentence number {i}", phones, speaker=f"S{i}")
            for i in range(4)]
    report = QualityReport(profile=profile_corpus(segs), vowel_space=_vspace())
    assert report.is_ready() is True
    assert "READY" in render_report(report)


def test_report_not_ready_on_misordered_vowels():
    bad = analyze_vowel_space([VowelMeasurement("IY", 750, 1100, "s1"),
                               VowelMeasurement("AA", 300, 2300, "s2")], "en")
    segs = [_seg(f"a#{i}", f"line {i}", speaker=f"S{i}") for i in range(3)]
    report = QualityReport(profile=profile_corpus(segs), vowel_space=bad)
    assert report.is_ready() is False
    assert any("vowel_space_misordered" in x for x in report.blocking_issues())


def test_report_not_ready_on_degenerate_phones():
    phones = [{"start_s": 0.0, "end_s": 0.001, "label": "P"},
              {"start_s": 0.001, "end_s": 0.002, "label": "AA1"}]
    segs = [_seg(f"a#{i}", f"line {i}", phones, speaker=f"S{i}") for i in range(3)]
    report = QualityReport(profile=profile_corpus(segs))
    assert report.is_ready() is False


def test_report_includes_optional_metrics():
    segs = [_seg("a#0", "hi", speaker="S0")]
    report = QualityReport(profile=profile_corpus(segs),
                           error_rates={"wer": 0.1, "cer": 0.05, "n_segments": 20},
                           boundary={"mean_abs_error_ms": 18.0,
                                     "within": {"20ms": 0.8}})
    md = render_report(report)
    assert "Label quality" in md and "boundary accuracy" in md


# -- end-to-end orchestrator --------------------------------------------

def test_run_corpus_end_to_end():
    raw = tempfile.mkdtemp()
    write_segmented_wav(os.path.join(raw, "a.wav"),
                        regions=[(1.0, 1.0), (1.4, 0.9)], gap_s=0.4)
    write_segmented_wav(os.path.join(raw, "b.wav"),
                        regions=[(0.8, 1.2)], gap_s=0.4, seed=2)
    out = tempfile.mkdtemp()
    result = run_corpus(raw, out, language="en")
    assert result.n_acquired == 2
    assert result.n_segments >= 2
    assert os.path.exists(os.path.join(out, "segments.jsonl"))
    assert os.path.exists(os.path.join(out, "QUALITY_REPORT.md"))
    assert os.path.exists(os.path.join(out, "export", "hf", "metadata.jsonl"))


def test_run_corpus_dedup_in_store():
    raw = tempfile.mkdtemp()
    write_segmented_wav(os.path.join(raw, "a.wav"),
                        regions=[(1.0, 1.0)], gap_s=0.4)
    import shutil
    shutil.copy2(os.path.join(raw, "a.wav"), os.path.join(raw, "a_copy.wav"))
    out = tempfile.mkdtemp()
    result = run_corpus(raw, out)
    assert result.n_acquired == 1   # duplicate dropped by content hash


# -- VoxPopuli (offline via injected opener) -----------------------------

def _canned_tar_with_wavs():
    d = tempfile.mkdtemp()
    w1 = os.path.join(d, "seg1.wav")
    write_segmented_wav(w1, regions=[(1.0, 0.8)], gap_s=0.3)
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tf:
        tf.add(w1, arcname="en_2020/seg1.wav")
        # a non-audio member that must be ignored
        info = tarfile.TarInfo("en_2020/readme.txt")
        data = b"notes"
        info.size = len(data)
        tf.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def test_voxpopuli_catalog_lists_year_shards():
    from corpus.acquisition.adapters.voxpopuli import VoxPopuliSource
    src = VoxPopuliSource(language="en", opener=lambda u: b"")
    items = list(src.catalog(limit=3))
    assert len(items) == 3
    assert all(it.license.value == "CC0-1.0" for it in items)
    assert items[0].audio_url.endswith(".tar")


def test_voxpopuli_fetch_extracts_audio_offline():
    from corpus.acquisition.adapters.voxpopuli import VoxPopuliSource
    tar_bytes = _canned_tar_with_wavs()
    src = VoxPopuliSource(language="en", opener=lambda u: tar_bytes,
                          transcode=False)
    item = next(src.catalog())
    tracks = src.fetch_tracks(item, tempfile.mkdtemp())
    assert len(tracks) == 1
    assert tracks[0].endswith(".wav")
    assert os.path.getsize(tracks[0]) > 0


def test_voxpopuli_rejects_unknown_language():
    from corpus.acquisition.adapters.voxpopuli import VoxPopuliSource
    try:
        VoxPopuliSource(language="xx")
        assert False
    except ValueError:
        pass
