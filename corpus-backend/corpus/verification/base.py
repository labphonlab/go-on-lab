"""Interface for content verification: "was the prompt read correctly?".

The production implementation runs ASR over the audio and compares the
hypothesis with the known prompt to produce a character error rate (CER). The
baseline here is an honest heuristic so the pipeline runs without ML deps.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from ..models import Prompt
from ..audio.wav import WavData


@dataclass
class VerificationResult:
    cer: Optional[float]          # character error rate vs. prompt (None if N/A)
    language_match: Optional[bool]
    transcript: Optional[str]
    is_heuristic: bool            # True if not derived from real ASR
    detail: str = ""

    def as_dict(self) -> dict:
        return {
            "cer": None if self.cer is None else round(self.cer, 4),
            "language_match": self.language_match,
            "transcript": self.transcript,
            "is_heuristic": self.is_heuristic,
            "detail": self.detail,
        }


class PromptVerifier:
    """Strategy interface. Swap in WhisperVerifier for real CER/WER."""

    def verify(self, wav: WavData, prompt: Prompt) -> VerificationResult:
        raise NotImplementedError
