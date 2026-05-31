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
