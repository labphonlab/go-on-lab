"""Strategy interfaces for the annotation pipeline stages.

Each interface has a zero-dependency baseline (see baselines.py) and a documented
production implementation (Silero / pyannote / WhisperX / MFA). Swapping is a
constructor change, not a rewrite.
"""

from __future__ import annotations

from .models import SpeechRegion, SpeakerTurn, Transcript
from ..audio.wav import WavData


class Segmenter:
    """Voice-activity detection: long audio -> speech regions."""

    def segment(self, wav: WavData) -> list[SpeechRegion]:
        raise NotImplementedError


class Diarizer:
    """Speaker diarization: 'who spoke when' over the whole recording."""

    def diarize(self, wav: WavData) -> list[SpeakerTurn]:
        raise NotImplementedError


class Transcriber:
    """ASR: a speech span -> transcript (+ word timings, language, confidence)."""

    def transcribe(self, wav: WavData, start_s: float, end_s: float,
                   declared_language: str | None = None) -> Transcript:
        raise NotImplementedError
