"""Synthesise PCM-WAV test signals (used by tests and the CLI demo).

Generates a band-limited tone with optional additive noise and leading/trailing
silence, so the QC pipeline can be exercised end-to-end without real recordings.
"""

from __future__ import annotations

import math
import random
import struct
import wave


def write_tone_wav(
    path: str,
    *,
    duration_s: float = 2.0,
    sample_rate: int = 16000,
    freq: float = 180.0,
    amplitude: float = 0.3,
    noise: float = 0.0,
    lead_silence_s: float = 0.1,
    bit_depth: int = 16,
    seed: int = 0,
) -> None:
    rng = random.Random(seed)
    n = int(duration_s * sample_rate)
    lead = int(lead_silence_s * sample_rate)
    maxval = (1 << (bit_depth - 1)) - 1
    sampwidth = bit_depth // 8

    frames = bytearray()
    for i in range(n):
        if i < lead or i > n - lead:
            s = 0.0
        else:
            s = amplitude * math.sin(2 * math.pi * freq * i / sample_rate)
        if noise:
            s += rng.uniform(-noise, noise)
        s = max(-1.0, min(1.0, s))
        iv = int(round(s * maxval))
        frames += int(iv).to_bytes(sampwidth, "little", signed=True)

    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(sampwidth)
        w.setframerate(sample_rate)
        w.writeframes(bytes(frames))


def write_segmented_wav(
    path: str,
    *,
    regions: list[tuple[float, float]],
    gap_s: float = 0.5,
    sample_rate: int = 16000,
    freq: float = 180.0,
    amplitude: float = 0.3,
    bit_depth: int = 16,
    seed: int = 0,
) -> float:
    """Write speech regions separated by silent gaps; return total duration.

    ``regions`` is a list of (freq_multiplier, duration_s) tuples — each becomes
    a tone burst, useful for exercising the VAD segmenter end to end.
    """
    rng = random.Random(seed)
    maxval = (1 << (bit_depth - 1)) - 1
    sampwidth = bit_depth // 8
    gap_n = int(gap_s * sample_rate)

    frames = bytearray()

    def _write_silence(n: int) -> None:
        for _ in range(n):
            frames.extend(int(0).to_bytes(sampwidth, "little", signed=True))

    def _write_tone(f_mult: float, dur_s: float) -> None:
        n = int(dur_s * sample_rate)
        for i in range(n):
            s = amplitude * math.sin(2 * math.pi * freq * f_mult * i / sample_rate)
            s += rng.uniform(-0.001, 0.001)
            s = max(-1.0, min(1.0, s))
            iv = int(round(s * maxval))
            frames.extend(int(iv).to_bytes(sampwidth, "little", signed=True))

    _write_silence(gap_n)
    for idx, (f_mult, dur_s) in enumerate(regions):
        if idx > 0:
            _write_silence(gap_n)
        _write_tone(f_mult, dur_s)
    _write_silence(gap_n)

    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(sampwidth)
        w.setframerate(sample_rate)
        w.writeframes(bytes(frames))

    return len(frames) / (sampwidth * sample_rate)
