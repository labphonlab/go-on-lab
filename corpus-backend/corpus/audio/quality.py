"""Acoustic quality control.

Computes the signal metrics described in docs/QUALITY_STANDARDS.md from a
:class:`~corpus.audio.wav.WavData`, then evaluates them against configurable
thresholds to produce :class:`~corpus.models.GateResult` objects.

Pure standard library. For long files a numpy fast path can be added later
behind the same interface; clip-length research recordings are fine in pure
Python.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from ..models import GateResult
from .wav import WavData

_EPS = 1e-12


def _dbfs(rms: float) -> float:
    """RMS (0..1 full scale) -> dBFS. Returns -inf for digital silence."""
    return 20.0 * math.log10(rms) if rms > _EPS else float("-inf")


@dataclass
class QCThresholds:
    min_sample_rate: int = 16000
    min_bit_depth: int = 16
    min_duration_s: float = 0.4
    max_duration_s: float = 30.0
    max_peak: float = 0.99
    max_clip_ratio: float = 0.001
    min_rms_dbfs: float = -36.0
    max_rms_dbfs: float = -12.0
    min_snr_db: float = 20.0
    max_silence_ratio: float = 0.60
    max_dc_offset: float = 0.02
    # severities: which failures merely flag for review vs. hard-reject
    soft_metrics: tuple = ("rms_dbfs", "snr_db", "silence_ratio")


@dataclass
class QCMetrics:
    sample_rate: int
    bit_depth: int
    channels: int
    duration_s: float
    peak: float
    clip_ratio: float
    rms: float
    rms_dbfs: float
    snr_db: float
    silence_ratio: float
    dc_offset: float

    def as_dict(self) -> dict:
        return {
            "sample_rate": self.sample_rate,
            "bit_depth": self.bit_depth,
            "channels": self.channels,
            "duration_s": round(self.duration_s, 4),
            "peak": round(self.peak, 5),
            "clip_ratio": round(self.clip_ratio, 6),
            "rms_dbfs": (None if math.isinf(self.rms_dbfs)
                         else round(self.rms_dbfs, 2)),
            "snr_db": round(self.snr_db, 2),
            "silence_ratio": round(self.silence_ratio, 4),
            "dc_offset": round(self.dc_offset, 5),
        }


def _windowed_rms_dbfs(samples: list[float], win: int) -> list[float]:
    """RMS (dBFS) per non-overlapping window — used for SNR & silence."""
    out: list[float] = []
    n = len(samples)
    for start in range(0, n, win):
        chunk = samples[start:start + win]
        if not chunk:
            continue
        s = 0.0
        for x in chunk:
            s += x * x
        out.append(_dbfs(math.sqrt(s / len(chunk))))
    return out


def compute_metrics(wav: WavData) -> QCMetrics:
    samples = wav.samples
    n = len(samples)
    if n == 0:
        return QCMetrics(wav.sample_rate, wav.bit_depth, wav.channels,
                         0.0, 0.0, 0.0, 0.0, float("-inf"), 0.0, 0.0, 0.0)

    peak = 0.0
    sumsq = 0.0
    dc = 0.0
    clipped = 0
    clip_level = 0.999
    for x in samples:
        ax = x if x >= 0 else -x
        if ax > peak:
            peak = ax
        sumsq += x * x
        dc += x
        if ax >= clip_level:
            clipped += 1

    rms = math.sqrt(sumsq / n)
    dc_offset = dc / n

    # Window ~30 ms for energy-based silence and noise-floor estimation.
    win = max(1, int(wav.sample_rate * 0.03))
    win_db = _windowed_rms_dbfs(samples, win)

    # Silence: fraction of windows below a fixed floor relative to full scale.
    silence_floor = -50.0
    silent_windows = sum(1 for d in win_db if d < silence_floor)
    silence_ratio = silent_windows / len(win_db) if win_db else 1.0

    # SNR heuristic: speech energy (loudest windows) vs. noise floor (quietest
    # windows). Digital-silence windows (-inf dBFS) are clamped to a floor rather
    # than discarded, so a recording with a genuinely quiet floor reads as high
    # SNR. For continuous speech with no quiet region this under-estimates SNR;
    # a VAD-based estimator is the documented upgrade path.
    DIGITAL_SILENCE_FLOOR = -120.0
    clamped = [DIGITAL_SILENCE_FLOOR if math.isinf(d) else d for d in win_db]
    if len(clamped) >= 4:
        ordered = sorted(clamped)
        k = max(1, len(ordered) // 10)
        noise_floor = sum(ordered[:k]) / k
        speech_level = sum(ordered[-k:]) / k
        snr_db = speech_level - noise_floor
    else:
        snr_db = 0.0

    return QCMetrics(
        sample_rate=wav.sample_rate,
        bit_depth=wav.bit_depth,
        channels=wav.channels,
        duration_s=wav.duration_s,
        peak=peak,
        clip_ratio=clipped / n,
        rms=rms,
        rms_dbfs=_dbfs(rms),
        snr_db=snr_db,
        silence_ratio=silence_ratio,
        dc_offset=dc_offset,
    )


def evaluate(metrics: QCMetrics, th: QCThresholds | None = None) -> list[GateResult]:
    """Turn metrics into pass/fail gates with hard/soft severities."""
    th = th or QCThresholds()
    sev = lambda name: "soft" if name in th.soft_metrics else "hard"  # noqa: E731
    g: list[GateResult] = []

    def add(name, passed, value, threshold):
        g.append(GateResult(name=name, passed=passed, value=value,
                            threshold=threshold, severity=sev(name)))

    add("sample_rate", metrics.sample_rate >= th.min_sample_rate,
        float(metrics.sample_rate), f">= {th.min_sample_rate}")
    add("bit_depth", metrics.bit_depth >= th.min_bit_depth,
        float(metrics.bit_depth), f">= {th.min_bit_depth}")
    add("duration_s", th.min_duration_s <= metrics.duration_s <= th.max_duration_s,
        metrics.duration_s, f"{th.min_duration_s}..{th.max_duration_s}")
    add("peak", metrics.peak <= th.max_peak, metrics.peak, f"<= {th.max_peak}")
    add("clip_ratio", metrics.clip_ratio <= th.max_clip_ratio,
        metrics.clip_ratio, f"<= {th.max_clip_ratio}")

    rms_ok = (not math.isinf(metrics.rms_dbfs)
              and th.min_rms_dbfs <= metrics.rms_dbfs <= th.max_rms_dbfs)
    add("rms_dbfs", rms_ok,
        None if math.isinf(metrics.rms_dbfs) else metrics.rms_dbfs,
        f"{th.min_rms_dbfs}..{th.max_rms_dbfs} dBFS")

    add("snr_db", metrics.snr_db >= th.min_snr_db, metrics.snr_db,
        f">= {th.min_snr_db} dB")
    add("silence_ratio", metrics.silence_ratio <= th.max_silence_ratio,
        metrics.silence_ratio, f"<= {th.max_silence_ratio}")
    add("dc_offset", abs(metrics.dc_offset) <= th.max_dc_offset,
        metrics.dc_offset, f"|dc| <= {th.max_dc_offset}")
    return g
