"""Zero-dependency PCM-WAV reader.

Returns mono-mixed samples normalised to [-1.0, 1.0] plus format metadata.
Supports 8/16/24/32-bit integer PCM (the lossless formats appropriate for a
research corpus). Float WAV and compressed formats are rejected explicitly so
callers never silently mis-read data.
"""

from __future__ import annotations

import wave
from dataclasses import dataclass


@dataclass
class WavData:
    sample_rate: int
    channels: int
    bit_depth: int
    n_frames: int
    samples: list[float]  # mono-mixed, normalised to [-1, 1]

    @property
    def duration_s(self) -> float:
        return self.n_frames / self.sample_rate if self.sample_rate else 0.0


class UnsupportedAudioError(ValueError):
    """Raised for formats we refuse to read rather than mis-interpret."""


def _decode_frames(raw: bytes, sampwidth: int, channels: int) -> list[float]:
    """Decode interleaved integer PCM bytes to mono-mixed normalised floats."""
    bytes_per_frame = sampwidth * channels
    n_frames = len(raw) // bytes_per_frame
    out: list[float] = [0.0] * n_frames

    if sampwidth == 1:
        # 8-bit PCM is unsigned, midpoint 128.
        norm = 1.0 / 128.0
        for f in range(n_frames):
            base = f * bytes_per_frame
            acc = 0
            for c in range(channels):
                acc += raw[base + c] - 128
            out[f] = (acc / channels) * norm
        return out

    signed_max = float(1 << (sampwidth * 8 - 1))
    norm = 1.0 / signed_max
    for f in range(n_frames):
        base = f * bytes_per_frame
        acc = 0
        for c in range(channels):
            off = base + c * sampwidth
            val = int.from_bytes(raw[off:off + sampwidth], "little", signed=True)
            acc += val
        out[f] = (acc / channels) * norm
    return out


def read_wav(path: str) -> WavData:
    """Read a PCM-WAV file into a :class:`WavData`."""
    with wave.open(path, "rb") as w:
        channels = w.getnchannels()
        sampwidth = w.getsampwidth()
        sample_rate = w.getframerate()
        n_frames = w.getnframes()
        comptype = w.getcomptype()
        raw = w.readframes(n_frames)

    if comptype != "NONE":
        raise UnsupportedAudioError(f"compressed WAV not supported: {comptype}")
    if sampwidth not in (1, 2, 3, 4):
        raise UnsupportedAudioError(f"unsupported sample width: {sampwidth} bytes")

    samples = _decode_frames(raw, sampwidth, channels)
    return WavData(
        sample_rate=sample_rate,
        channels=channels,
        bit_depth=sampwidth * 8,
        n_frames=len(samples),
        samples=samples,
    )
