import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.audio.synth import write_segmented_wav
from corpus.audio.wav import read_wav
from corpus.annotation.baselines import (
    EnergySegmenter, NullDiarizer, NullTranscriber)
from corpus.annotation.segmentation import intersect
from corpus.annotation.models import SpeechRegion, SpeakerTurn, Segment, Transcript
from corpus.annotation.orchestrator import AnnotationPipeline
from corpus.annotation.evaluation import _wer, measure_wer, sample_for_review
from corpus.annotation import manifest as ann_manifest
from corpus.models import ItemState


def _multi_region_wav():
    path = os.path.join(tempfile.mkdtemp(), "src.wav")
    write_segmented_wav(path, regions=[(1.0, 1.2), (1.5, 0.9), (0.8, 1.5)],
                        gap_s=0.5)
    return path


def test_energy_segmenter_finds_three_regions():
    wav = read_wav(_multi_region_wav())
    regions = EnergySegmenter().segment(wav)
    assert len(regions) == 3
    for r in regions:
        assert r.duration_s >= 0.3
    # regions are ordered and non-overlapping
    for a, b in zip(regions, regions[1:]):
        assert a.end_s <= b.start_s


def test_intersect_splits_on_speaker_boundary():
    regions = [SpeechRegion(0.0, 10.0)]
    turns = [SpeakerTurn(0.0, 4.0, "SPEAKER_00"),
             SpeakerTurn(4.0, 10.0, "SPEAKER_01")]
    spans = intersect(regions, turns)
    assert len(spans) == 2
    assert spans[0][2] == "SPEAKER_00"
    assert spans[1][2] == "SPEAKER_01"
    assert abs(spans[0][1] - 4.0) < 1e-6


def test_pipeline_segments_and_routes_to_review_without_asr():
    segments = AnnotationPipeline().annotate_file(_multi_region_wav(),
                                                  source_id="src")
    assert len(segments) == 3
    # baseline has no ASR -> no fabricated text -> review, never accepted
    assert all(s.transcript is not None and s.transcript.text is None
               for s in segments)
    assert all(s.state == ItemState.REVIEW for s in segments)
    assert all(s.speaker == "SPEAKER_00" for s in segments)


def test_short_blip_is_rejected_on_duration():
    # one very short region below min duration should not survive segmentation
    path = os.path.join(tempfile.mkdtemp(), "blip.wav")
    write_segmented_wav(path, regions=[(1.0, 1.2)], gap_s=0.5)
    segs = AnnotationPipeline().annotate_file(path, source_id="b")
    assert len(segs) == 1
    assert segs[0].duration_s >= 0.3


def test_null_transcriber_does_not_fabricate():
    wav = read_wav(_multi_region_wav())
    tr = NullTranscriber().transcribe(wav, 0.0, 1.0)
    assert tr.text is None
    assert tr.is_heuristic is True


def test_wer_basic():
    err, words = _wer("the quick brown fox", "the quick brown fox")
    assert (err, words) == (0, 4)
    err, words = _wer("the quick brown fox", "the quick brown dog")
    assert err == 1 and words == 4


def test_measure_wer_against_corrections():
    seg = Segment("s0", "src", 0.0, 1.0, "SPEAKER_00",
                  transcript=Transcript(text="the quick brown dog"))
    result = measure_wer({"s0": "the quick brown fox"}, [seg])
    assert result.total_words == 4
    assert result.total_errors == 1
    assert abs(result.wer - 0.25) < 1e-9


def test_sample_for_review_is_deterministic_and_bounded():
    segs = [Segment(f"s{i}", "src", float(i), float(i) + 1, "SPEAKER_00")
            for i in range(10)]
    a = sample_for_review(segs, 3, seed=42)
    b = sample_for_review(segs, 3, seed=42)
    assert [s.segment_id for s in a] == [s.segment_id for s in b]
    assert len(a) == 3


def test_export_writes_segments_and_card_with_wer():
    segments = AnnotationPipeline().annotate_file(_multi_region_wav(),
                                                  source_id="src")
    out = tempfile.mkdtemp()
    wer = {"n_segments": 2, "total_errors": 1, "total_words": 20, "wer": 0.05}
    summary = ann_manifest.export(segments, out, wer=wer)
    assert os.path.exists(os.path.join(out, "segments.jsonl"))
    card = open(os.path.join(out, "DATASET_CARD.md"), encoding="utf-8").read()
    assert "Word Error Rate" in card
    assert summary["segments"] == 3
