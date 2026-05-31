"""Offline tests for the WhisperX result -> Segment mapping (no ML needed)."""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.annotation.whisperx_pipeline import (
    segments_from_whisperx, _majority_speaker)
from corpus.annotation.orchestrator import AnnotationPolicy
from corpus.models import ItemState


def _result():
    return {
        "language": "en",
        "segments": [
            {"start": 0.0, "end": 2.0, "text": "hello world", "speaker": "SPEAKER_00",
             "words": [
                 {"word": "hello", "start": 0.0, "end": 0.5, "score": 0.95,
                  "speaker": "SPEAKER_00"},
                 {"word": "world", "start": 0.6, "end": 1.0, "score": 0.91,
                  "speaker": "SPEAKER_00"},
             ]},
            {"start": 2.5, "end": 5.0, "text": "goodbye now", "speaker": "SPEAKER_01",
             "words": [
                 {"word": "goodbye", "start": 2.5, "end": 3.2, "score": 0.40},
                 {"word": "now", "start": 3.3, "end": 3.8, "score": 0.42},
             ]},
        ],
    }


def test_maps_segments_with_words_and_speakers():
    segs = segments_from_whisperx(_result(), source_id="rec1")
    assert len(segs) == 2
    assert segs[0].segment_id == "rec1#0000"
    assert segs[0].speaker == "SPEAKER_00"
    assert segs[0].transcript.text == "hello world"
    assert segs[0].transcript.language == "en"
    assert segs[0].transcript.is_heuristic is False
    assert len(segs[0].transcript.words) == 2
    assert segs[0].transcript.words[0].word == "hello"


def test_confidence_is_mean_word_score():
    segs = segments_from_whisperx(_result())
    # (0.95 + 0.91) / 2 = 0.93
    assert abs(segs[0].transcript.confidence - 0.93) < 1e-9


def test_high_confidence_segment_accepted():
    segs = segments_from_whisperx(_result(),
                                  policy=AnnotationPolicy(min_snr_db=-999))
    # first segment: high confidence, has text -> accepted
    assert segs[0].state == ItemState.ACCEPTED


def test_low_confidence_segment_routed_to_review():
    segs = segments_from_whisperx(_result(),
                                  policy=AnnotationPolicy(min_snr_db=-999))
    # second segment: mean score ~0.41 < 0.6 -> soft fail -> review
    assert segs[1].state == ItemState.REVIEW
    assert any(g.name == "asr_confidence" and not g.passed for g in segs[1].gates)


def test_language_mismatch_flagged():
    segs = segments_from_whisperx(_result(), declared_language="ja",
                                  policy=AnnotationPolicy(min_snr_db=-999))
    assert any(g.name == "language_match" and not g.passed for g in segs[0].gates)


def test_majority_speaker_from_words_when_segment_label_absent():
    words = [{"speaker": "S1"}, {"speaker": "S1"}, {"speaker": "S2"}]
    assert _majority_speaker(words) == "S1"
    result = {"language": "en", "segments": [
        {"start": 0.0, "end": 1.0, "text": "hi", "words": words}]}
    segs = segments_from_whisperx(result)
    assert segs[0].speaker == "S1"


def test_empty_result_is_empty():
    assert segments_from_whisperx({"segments": []}, "x") == []
