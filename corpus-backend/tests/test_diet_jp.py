"""Offline tests for the Japanese Diet (kokkai) adapter.

Network is blocked here, so an injected fake Opener serves canned kokkai JSON,
including a two-page response to verify pagination. This exercises all client
logic: per-speech parsing, speaker extraction, editorial-mark cleaning,
transcript assembly and pagination.
"""

import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.acquisition.adapters.diet_jp import (
    DietJapanSource, clean_speech, speeches_from_meeting)
from corpus.models import License


def _meeting(issue_id, speeches):
    return {
        "issueID": issue_id, "nameOfHouse": "衆議院",
        "nameOfMeeting": "予算委員会", "date": "2024-02-01", "session": 213,
        "meetingURL": f"https://kokkai.ndl.go.jp/#/detail?minId={issue_id}",
        "speechRecord": speeches,
    }


def _speech(order, speaker, text, sid=""):
    return {"speechOrder": order, "speaker": speaker, "speech": text,
            "speechID": sid}


def _paged_opener(pages):
    """pages: list of (meetingRecord list, nextRecordPosition or None)."""
    calls = {"n": 0}

    def opener(url):
        idx = calls["n"]
        calls["n"] += 1
        meetings, nxt = pages[idx] if idx < len(pages) else ([], None)
        body = {"numberOfRecords": 99, "meetingRecord": meetings}
        if nxt is not None:
            body["nextRecordPosition"] = nxt
        return json.dumps(body, ensure_ascii=False).encode("utf-8")
    return opener


def test_clean_speech_strips_speaker_prefix():
    # "○安倍晋三君　ただいま…" -> "ただいま…"
    assert clean_speech("○安倍晋三君　ただいま議題となりました") == "ただいま議題となりました"
    # bare circle with no name prefix
    assert clean_speech("○はい、そのとおりです") == "はい、そのとおりです"
    assert clean_speech("") == ""


def test_speeches_from_meeting_extracts_speakers_and_skips_empty():
    rec = _meeting("m1", [
        _speech(1, "会議録情報", "", "s0"),          # empty body -> skipped
        _speech(2, "安倍晋三", "○安倍晋三君　よろしくお願いします", "s1"),
        _speech(3, "田中太郎", "○田中太郎君　質問します", "s2"),
    ])
    speeches = speeches_from_meeting(rec)
    assert len(speeches) == 2
    assert speeches[0].speaker == "安倍晋三"
    assert speeches[0].text == "よろしくお願いします"
    assert speeches[0].speech_id == "s1"


def test_catalog_builds_speaker_labeled_item():
    op = _paged_opener([([_meeting("m1", [
        _speech(1, "安倍晋三", "○安倍晋三君　おはようございます"),
        _speech(2, "田中太郎", "○田中太郎君　よろしく"),
    ])], None)])
    src = DietJapanSource(opener=op)
    items = list(src.catalog(limit=10))
    assert len(items) == 1
    it = items[0]
    assert it.language == "ja"
    assert it.license == License.CC0_1_0
    assert it.audio_url == ""              # no audio from the record API
    assert "衆議院" in it.title
    assert it.extra["speakers"] == ["安倍晋三", "田中太郎"]
    assert len(it.extra["speeches"]) == 2
    assert it.transcript == "おはようございます\nよろしく"


def test_catalog_paginates():
    pages = [
        ([_meeting("m1", [_speech(1, "A", "○A君　one")])], 2),   # nextRecordPosition=2
        ([_meeting("m2", [_speech(1, "B", "○B君　two")])], None),
    ]
    src = DietJapanSource(opener=_paged_opener(pages))
    items = list(src.catalog(limit=10))
    assert [it.item_id for it in items] == ["m1", "m2"]


def test_catalog_respects_limit_across_pages():
    pages = [
        ([_meeting("m1", [_speech(1, "A", "○A君　one")]),
          _meeting("m2", [_speech(1, "B", "○B君　two")])], 3),
        ([_meeting("m3", [_speech(1, "C", "○C君　three")])], None),
    ]
    src = DietJapanSource(opener=_paged_opener(pages))
    items = list(src.catalog(limit=2))
    assert len(items) == 2                 # stops mid-stream at the limit


def test_fetch_raises_with_actionable_message():
    op = _paged_opener([([_meeting("m1", [_speech(1, "A", "○A君　hi")])], None)])
    src = DietJapanSource(opener=op)
    item = next(src.catalog())
    try:
        src.fetch(item, "/tmp")
        assert False, "expected NotImplementedError"
    except NotImplementedError as exc:
        assert "out-of-band" in str(exc)
