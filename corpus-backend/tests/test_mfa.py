"""Offline tests for TextGrid parsing and MFA phone attachment + prep."""

import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.alignment.textgrid import TextGrid
from corpus.alignment.mfa import phones_from_textgrid, attach_phones
from corpus.annotation.models import Segment, Transcript
from corpus.annotation.mfa_prep import prepare_mfa_corpus
from corpus.audio.synth import write_tone_wav
from corpus.audio.wav import read_wav
from corpus.models import ItemState


_TG = """File type = "ooTextFile"
Object class = "TextGrid"

xmin = 0
xmax = 1.0
tiers? <exists>
size = 2
item []:
    item [1]:
        class = "IntervalTier"
        name = "words"
        xmin = 0
        xmax = 1.0
        intervals: size = 2
        intervals [1]:
            xmin = 0.0
            xmax = 0.5
            text = "hello"
        intervals [2]:
            xmin = 0.5
            xmax = 1.0
            text = ""
    item [2]:
        class = "IntervalTier"
        name = "phones"
        xmin = 0
        xmax = 1.0
        intervals: size = 3
        intervals [1]:
            xmin = 0.0
            xmax = 0.2
            text = "HH"
        intervals [2]:
            xmin = 0.2
            xmax = 0.4
            text = "AH0"
        intervals [3]:
            xmin = 0.4
            xmax = 0.5
            text = "L"
"""


def test_textgrid_parses_two_tiers():
    tg = TextGrid.parse(_TG)
    names = [t.name for t in tg.tiers]
    assert names == ["words", "phones"]
    phones = tg.tier("phones")
    assert len(phones.intervals) == 3
    assert phones.intervals[0].text == "HH"
    assert abs(phones.intervals[0].xmax - 0.2) < 1e-9


def test_phones_from_textgrid_skips_empty():
    d = tempfile.mkdtemp()
    p = os.path.join(d, "x.TextGrid")
    open(p, "w", encoding="utf-8").write(_TG)
    phones = phones_from_textgrid(p)
    assert [ph["label"] for ph in phones] == ["HH", "AH0", "L"]
    assert phones[0]["start_s"] == 0.0


def test_attach_phones_matches_segment_id_encoding():
    seg = Segment("rec1#0001", "rec1", 0.0, 1.0, "SPEAKER_00",
                  transcript=Transcript(text="hello"))
    d = tempfile.mkdtemp()
    # encoding: '#' -> '_', '/' -> '__'
    open(os.path.join(d, "rec1_0001.TextGrid"), "w", encoding="utf-8").write(_TG)
    n = attach_phones([seg], d)
    assert n == 1
    assert [p["label"] for p in seg.phones] == ["HH", "AH0", "L"]


def test_prepare_mfa_corpus_writes_pairs_for_accepted_only():
    path = os.path.join(tempfile.mkdtemp(), "src.wav")
    write_tone_wav(path, duration_s=3.0, amplitude=0.3)
    wav = read_wav(path)

    accepted = Segment("rec#0000", "rec", 0.0, 1.0, "SPEAKER_00",
                       transcript=Transcript(text="hello"))
    accepted.state = ItemState.ACCEPTED
    review = Segment("rec#0001", "rec", 1.0, 2.0, "SPEAKER_00",
                     transcript=Transcript(text="world"))
    review.state = ItemState.REVIEW
    no_text = Segment("rec#0002", "rec", 2.0, 3.0, "SPEAKER_00",
                      transcript=Transcript(text=None))
    no_text.state = ItemState.ACCEPTED

    out = tempfile.mkdtemp()
    n = prepare_mfa_corpus(wav, [accepted, review, no_text], out)
    assert n == 1  # only the accepted-with-text segment
    assert os.path.exists(os.path.join(out, "rec_0000.wav"))
    assert os.path.exists(os.path.join(out, "rec_0000.txt"))
    assert open(os.path.join(out, "rec_0000.txt"), encoding="utf-8").read().strip() == "hello"
    # the review and no-text ones are not written
    assert not os.path.exists(os.path.join(out, "rec_0001.wav"))


def test_prepare_then_clip_is_readable_wav():
    path = os.path.join(tempfile.mkdtemp(), "src.wav")
    write_tone_wav(path, duration_s=2.0, amplitude=0.3)
    wav = read_wav(path)
    seg = Segment("r#0000", "r", 0.2, 1.2, "SPEAKER_00",
                  transcript=Transcript(text="hi"))
    seg.state = ItemState.ACCEPTED
    out = tempfile.mkdtemp()
    prepare_mfa_corpus(wav, [seg], out)
    clip = read_wav(os.path.join(out, "r_0000.wav"))
    assert abs(clip.duration_s - 1.0) < 0.05
    assert clip.sample_rate == wav.sample_rate
