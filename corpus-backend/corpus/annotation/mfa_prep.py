"""Prepare WhisperX-segmented audio for Montreal Forced Aligner.

MFA expects a corpus directory of paired ``<name>.wav`` + ``<name>.txt`` files,
one per utterance. This writes a clip per accepted segment (using the segment's
time span) plus its WhisperX transcript, so MFA can add phone boundaries. The
clip extraction is pure standard library (slice the decoded samples, write WAV).
"""

from __future__ import annotations

import os
import wave

from ..audio.wav import WavData
from ..models import ItemState


def _safe_name(segment_id: str) -> str:
    return segment_id.replace("/", "__").replace("#", "_")


def _write_clip(wav: WavData, start_s: float, end_s: float, path: str,
                bit_depth: int = 16) -> None:
    sr = wav.sample_rate
    a = max(0, int(start_s * sr))
    b = min(len(wav.samples), int(end_s * sr))
    maxval = (1 << (bit_depth - 1)) - 1
    sampwidth = bit_depth // 8
    frames = bytearray()
    for x in wav.samples[a:b]:
        iv = int(round(max(-1.0, min(1.0, x)) * maxval))
        frames += int(iv).to_bytes(sampwidth, "little", signed=True)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(sampwidth)
        w.setframerate(sr)
        w.writeframes(bytes(frames))


def prepare_mfa_corpus(wav: WavData, segments: list, out_dir: str,
                       accepted_only: bool = True) -> int:
    """Write <name>.wav + <name>.txt per segment into ``out_dir`` for MFA.

    Returns the number of utterances written. Segments without a transcript are
    skipped (MFA needs text). Segment ids are encoded to filename-safe names; the
    same encoding is used by ``alignment.mfa.attach_phones`` to match results.
    """
    os.makedirs(out_dir, exist_ok=True)
    n = 0
    for seg in segments:
        if accepted_only and seg.state != ItemState.ACCEPTED:
            continue
        if not (seg.transcript and seg.transcript.text):
            continue
        name = _safe_name(seg.segment_id)
        _write_clip(wav, seg.start_s, seg.end_s, os.path.join(out_dir, name + ".wav"))
        with open(os.path.join(out_dir, name + ".txt"), "w", encoding="utf-8") as fh:
            fh.write(seg.transcript.text.strip() + "\n")
        n += 1
    return n
