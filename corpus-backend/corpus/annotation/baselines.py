"""Zero-dependency baseline implementations of the annotation stages.

These make the pipeline runnable and testable today. They are honest about their
limits: the null transcriber does NOT invent text, and segments it cannot
transcribe are routed to review rather than silently accepted.

Production swaps:
    EnergySegmenter   -> SileroSegmenter   (corpus.annotation.plugins)
    NullDiarizer      -> PyannoteDiarizer
    NullTranscriber   -> WhisperXTranscriber
"""

from __future__ import annotations

import math

from .base import Segmenter, Diarizer, Transcriber
from .models import SpeechRegion, SpeakerTurn, Transcript
from ..audio.wav import WavData


class EnergySegmenter(Segmenter):
    """Energy/silence VAD: merge speech windows, drop short gaps and blips."""

    def __init__(self, win_s: float = 0.03, speech_floor_dbfs: float = -45.0,
                 min_speech_s: float = 0.3, min_gap_s: float = 0.2):
        self.win_s = win_s
        self.speech_floor = speech_floor_dbfs
        self.min_speech_s = min_speech_s
        self.min_gap_s = min_gap_s

    def segment(self, wav: WavData) -> list[SpeechRegion]:
        s = wav.samples
        sr = wav.sample_rate
        if not s or sr <= 0:
            return []
        win = max(1, int(sr * self.win_s))
        win_s = win / sr

        # Per-window speech/non-speech flags.
        flags: list[bool] = []
        for start in range(0, len(s), win):
            chunk = s[start:start + win]
            if not chunk:
                break
            energy = sum(x * x for x in chunk) / len(chunk)
            db = 10.0 * math.log10(energy) if energy > 1e-12 else float("-inf")
            flags.append(db >= self.speech_floor)

        # Flags -> raw regions.
        regions: list[list[int]] = []
        in_speech = False
        for i, f in enumerate(flags):
            if f and not in_speech:
                regions.append([i, i])
                in_speech = True
            elif f and in_speech:
                regions[-1][1] = i
            else:
                in_speech = False

        # Merge regions separated by gaps shorter than min_gap.
        merged: list[list[int]] = []
        gap_win = max(1, int(self.min_gap_s / win_s))
        for r in regions:
            if merged and r[0] - merged[-1][1] <= gap_win:
                merged[-1][1] = r[1]
            else:
                merged.append(r)

        out: list[SpeechRegion] = []
        for a, b in merged:
            start_s = a * win_s
            end_s = min(wav.duration_s, (b + 1) * win_s)
            if end_s - start_s >= self.min_speech_s:
                out.append(SpeechRegion(start_s, end_s))
        return out


class NullDiarizer(Diarizer):
    """Assigns all audio to a single estimated speaker.

    Honest placeholder for single-source audio and for tests. Real multi-speaker
    work uses PyannoteDiarizer; until then every turn is flagged is_estimate.
    """

    def diarize(self, wav: WavData) -> list[SpeakerTurn]:
        return [SpeakerTurn(0.0, wav.duration_s, "SPEAKER_00", is_estimate=True)]


class NullTranscriber(Transcriber):
    """Produces a transcript object WITHOUT inventing text.

    It cannot read words without an ASR model, so ``text`` stays ``None`` and
    ``is_heuristic`` is True. The gate then routes such segments to review. This
    keeps the pipeline runnable while never fabricating labels.
    """

    def transcribe(self, wav: WavData, start_s: float, end_s: float,
                   declared_language: str | None = None) -> Transcript:
        return Transcript(
            text=None,
            language=declared_language,
            confidence=None,
            words=[],
            is_heuristic=True,
        )
