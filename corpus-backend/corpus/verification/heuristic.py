"""Baseline content verifier (no ML dependency).

It cannot read the words, so it does NOT fabricate a CER. Instead it checks that
the recording's duration is plausible for the prompt length (a reasonable
speaking rate), flags implausible cases for review, and marks the result
``is_heuristic=True`` so downstream consumers know it is not ASR-derived.

Replace with :class:`WhisperVerifier` (see asr.py) for production CER/WER.
"""

from __future__ import annotations

from .base import PromptVerifier, VerificationResult
from ..models import Prompt
from ..audio.wav import WavData


class HeuristicVerifier(PromptVerifier):
    # plausible speaking rate window (words per second) for read speech
    MIN_WPS = 1.0
    MAX_WPS = 4.5

    def verify(self, wav: WavData, prompt: Prompt) -> VerificationResult:
        tokens = max(1, prompt.token_count())
        dur = wav.duration_s
        wps = tokens / dur if dur > 0 else 0.0
        plausible = self.MIN_WPS <= wps <= self.MAX_WPS
        detail = f"speaking_rate={wps:.2f} wps (plausible {self.MIN_WPS}-{self.MAX_WPS})"
        return VerificationResult(
            cer=None,                     # unknown without ASR — do not fake it
            language_match=None,
            transcript=None,
            is_heuristic=True,
            detail=("ok " if plausible else "implausible duration; ") + detail,
        )
