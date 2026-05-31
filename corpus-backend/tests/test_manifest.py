import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.audio.synth import write_tone_wav
from corpus.models import ConsentRecord, License, Prompt, Recording
from corpus.pipeline.orchestrator import Pipeline
from corpus.storage import manifest


def _build_items():
    pipe = Pipeline()
    consent = ConsentRecord("c1", "spk1", "v1", True, True, True)
    prompt = Prompt("en-0001", "en", "the quick brown fox jumps", License.CC0_1_0)
    items = []
    d = tempfile.mkdtemp()
    for name, amp in [("clean.wav", 0.3), ("clip.wav", 1.5)]:
        path = os.path.join(d, name)
        write_tone_wav(path, duration_s=2.5, amplitude=amp)
        rec = Recording(name, "en-0001", "spk1", path)
        items.append(pipe.process(rec, prompt, consent, License.CC_BY_4_0))
    return items


def test_export_writes_all_artifacts():
    items = _build_items()
    out = tempfile.mkdtemp()
    summary = manifest.export_corpus(items, out)  # accepted only
    assert os.path.exists(os.path.join(out, "manifest.jsonl"))
    assert os.path.exists(os.path.join(out, "manifest.csv"))
    assert os.path.exists(os.path.join(out, "DATASET_CARD.md"))
    # one clean accepted, one clipped rejected -> only the clean one exported
    assert summary["total"] == 1
    assert summary["by_state"].get("accepted") == 1


def test_commercial_export_filters_sellable():
    items = _build_items()
    out = tempfile.mkdtemp()
    manifest.export_corpus(items, out, commercial_only=True)
    with open(os.path.join(out, "manifest.jsonl"), encoding="utf-8") as fh:
        rows = [json.loads(line) for line in fh]
    assert all(r["sellable"] for r in rows)


def test_summary_counts_speakers_and_languages():
    s = manifest.summarise(_build_items())
    assert s["speakers"] == 1
    assert s["by_language"].get("en") == 2
