import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.audio.synth import write_tone_wav
from corpus.models import ConsentRecord, License, Prompt, Recording, ItemState
from corpus.pipeline.orchestrator import Pipeline


def _consent(speaker="spk1", commercial=True, redistribution=True, withdrawn=False):
    return ConsentRecord(
        consent_id="c1", speaker_id=speaker, version="2026-05-01",
        commercial_use=commercial, redistribution=redistribution,
        derivatives=True, withdrawn=withdrawn,
    )


def _prompt():
    return Prompt("en-0001", "en", "the quick brown fox jumps over", License.CC0_1_0)


def _wav(name, **kw):
    path = os.path.join(tempfile.mkdtemp(), name)
    write_tone_wav(path, **kw)
    return path


def test_clean_recording_accepted_and_sellable():
    path = _wav("clean.wav", duration_s=2.5, amplitude=0.3, noise=0.0)
    rec = Recording("r1", "en-0001", "spk1", path)
    item = Pipeline().process(rec, _prompt(), _consent(), License.CC_BY_4_0)
    assert item.state == ItemState.ACCEPTED
    assert item.is_sellable() is True
    # provenance and qc were recorded
    assert item.provenance.processed_at is not None
    assert item.qc_metrics["sample_rate"] == 16000
    assert item.alignment, "expected baseline alignment spans"


def test_clipped_recording_rejected():
    path = _wav("clip.wav", duration_s=2.0, amplitude=1.5)
    rec = Recording("r2", "en-0001", "spk1", path)
    item = Pipeline().process(rec, _prompt(), _consent(), License.CC_BY_4_0)
    assert item.state == ItemState.REJECTED
    assert item.is_sellable() is False
    assert any(g.name == "clip_ratio" for g in item.failed_hard())


def test_withdrawn_consent_rejected():
    path = _wav("clean.wav", duration_s=2.0, amplitude=0.3)
    rec = Recording("r3", "en-0001", "spk1", path)
    item = Pipeline().process(rec, _prompt(), _consent(withdrawn=True),
                              License.CC_BY_4_0)
    assert item.state == ItemState.REJECTED
    assert any(g.name == "consent_active" for g in item.failed_hard())


def test_accepted_but_noncommercial_consent_not_sellable():
    path = _wav("clean.wav", duration_s=2.5, amplitude=0.3)
    rec = Recording("r4", "en-0001", "spk1", path)
    item = Pipeline().process(rec, _prompt(), _consent(commercial=False),
                              License.CC_BY_4_0)
    assert item.state == ItemState.ACCEPTED
    assert item.is_sellable() is False


def test_nc_license_not_sellable_even_with_full_consent():
    path = _wav("clean.wav", duration_s=2.5, amplitude=0.3)
    rec = Recording("r5", "en-0001", "spk1", path)
    item = Pipeline().process(rec, _prompt(), _consent(), License.CC_BY_NC_4_0)
    assert item.state == ItemState.ACCEPTED
    assert item.is_sellable() is False


def test_missing_audio_file_rejected():
    rec = Recording("r6", "en-0001", "spk1", "/no/such/file.wav")
    item = Pipeline().process(rec, _prompt(), _consent(), License.CC_BY_4_0)
    assert item.state == ItemState.REJECTED
    assert any(g.name == "audio_readable" for g in item.failed_hard())
