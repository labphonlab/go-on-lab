import os
import sys
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.audio.synth import write_tone_wav
from corpus.audio.wav import read_wav, UnsupportedAudioError
from corpus.audio.quality import compute_metrics, evaluate, QCThresholds


def _tmp(name):
    return os.path.join(tempfile.mkdtemp(), name)


def test_wav_roundtrip_format():
    p = _tmp("a.wav")
    write_tone_wav(p, duration_s=1.0, sample_rate=16000, bit_depth=16)
    wav = read_wav(p)
    assert wav.sample_rate == 16000
    assert wav.bit_depth == 16
    assert wav.channels == 1
    assert abs(wav.duration_s - 1.0) < 0.01
    assert all(-1.0 <= s <= 1.0 for s in wav.samples[:100])


def test_clean_signal_passes_hard_gates():
    p = _tmp("clean.wav")
    write_tone_wav(p, duration_s=2.5, amplitude=0.3, noise=0.0)
    metrics = compute_metrics(read_wav(p))
    gates = evaluate(metrics)
    hard_fails = [g.name for g in gates if not g.passed and g.severity == "hard"]
    assert hard_fails == [], f"unexpected hard failures: {hard_fails}"


def test_clipping_is_detected():
    p = _tmp("clip.wav")
    write_tone_wav(p, duration_s=2.0, amplitude=1.5, noise=0.0)  # over full scale
    metrics = compute_metrics(read_wav(p))
    assert metrics.peak >= 0.99
    gates = {g.name: g for g in evaluate(metrics)}
    assert not gates["clip_ratio"].passed
    assert gates["clip_ratio"].severity == "hard"


def test_low_sample_rate_fails():
    p = _tmp("lo.wav")
    write_tone_wav(p, duration_s=1.0, sample_rate=8000)
    metrics = compute_metrics(read_wav(p))
    gates = {g.name: g for g in evaluate(metrics)}
    assert not gates["sample_rate"].passed


def test_snr_higher_for_clean_than_noisy():
    clean = _tmp("c.wav")
    noisy = _tmp("n.wav")
    write_tone_wav(clean, duration_s=2.0, amplitude=0.3, noise=0.0)
    write_tone_wav(noisy, duration_s=2.0, amplitude=0.3, noise=0.1)
    m_clean = compute_metrics(read_wav(clean))
    m_noisy = compute_metrics(read_wav(noisy))
    assert m_clean.snr_db > m_noisy.snr_db
