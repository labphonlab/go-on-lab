"""Interface for forced alignment: time-stamp each prompt token in the audio."""

from __future__ import annotations

from dataclasses import dataclass

from ..models import Prompt
from ..audio.wav import WavData


@dataclass
class TokenAlignment:
    token: str
    start_s: float
    end_s: float
    is_estimate: bool  # True if not from a real acoustic aligner

    def as_dict(self) -> dict:
        return {
            "token": self.token,
            "start_s": round(self.start_s, 4),
            "end_s": round(self.end_s, 4),
            "is_estimate": self.is_estimate,
        }


class ForcedAligner:
    """Strategy interface. Swap in MFA / whisperX for phone-accurate boundaries."""

    def align(self, wav: WavData, prompt: Prompt) -> list[TokenAlignment]:
        raise NotImplementedError
