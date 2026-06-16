"""Domain types for the automatic annotation (pseudo-labeling) pipeline.

A long recording is decomposed into a list of :class:`Segment` objects, each a
speaker-homogeneous span of speech carrying its machine-generated label and the
scores that justify its accept/review/reject decision.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from ..models import GateResult, ItemState


@dataclass
class SpeechRegion:
    """A VAD-detected span of speech (seconds), before labeling."""

    start_s: float
    end_s: float

    @property
    def duration_s(self) -> float:
        return self.end_s - self.start_s


@dataclass
class SpeakerTurn:
    """A diarized span attributed to one speaker label."""

    start_s: float
    end_s: float
    speaker: str           # local label, e.g. "SPEAKER_00"
    is_estimate: bool = True

    @property
    def duration_s(self) -> float:
        return self.end_s - self.start_s


@dataclass
class WordTiming:
    word: str
    start_s: float
    end_s: float
    confidence: Optional[float] = None

    def as_dict(self) -> dict:
        return {
            "word": self.word,
            "start_s": round(self.start_s, 4),
            "end_s": round(self.end_s, 4),
            "confidence": (None if self.confidence is None
                           else round(self.confidence, 4)),
        }


@dataclass
class Transcript:
    """ASR output for a segment. ``None`` text means 'not transcribed'."""

    text: Optional[str]
    language: Optional[str] = None
    confidence: Optional[float] = None
    words: list[WordTiming] = field(default_factory=list)
    is_heuristic: bool = False  # True if not from a real ASR model

    def as_dict(self) -> dict:
        return {
            "text": self.text,
            "language": self.language,
            "confidence": (None if self.confidence is None
                           else round(self.confidence, 4)),
            "words": [w.as_dict() for w in self.words],
            "is_heuristic": self.is_heuristic,
        }


@dataclass
class Segment:
    """A speaker-homogeneous speech span with its label and decision."""

    segment_id: str
    source_id: str          # id of the long source recording
    start_s: float
    end_s: float
    speaker: str
    transcript: Optional[Transcript] = None
    phones: list = field(default_factory=list)  # phone-level alignment (MFA)
    scores: dict = field(default_factory=dict)  # snr_db, asr_conf, ...
    gates: list[GateResult] = field(default_factory=list)
    state: ItemState = ItemState.PENDING

    @property
    def duration_s(self) -> float:
        return self.end_s - self.start_s

    def failed_hard(self) -> list[GateResult]:
        return [g for g in self.gates if not g.passed and g.severity == "hard"]

    def failed_soft(self) -> list[GateResult]:
        return [g for g in self.gates if not g.passed and g.severity == "soft"]

    def decide(self) -> ItemState:
        if self.failed_hard():
            self.state = ItemState.REJECTED
        elif self.failed_soft():
            self.state = ItemState.REVIEW
        else:
            self.state = ItemState.ACCEPTED
        return self.state

    def to_dict(self) -> dict:
        return {
            "segment_id": self.segment_id,
            "source_id": self.source_id,
            "start_s": round(self.start_s, 4),
            "end_s": round(self.end_s, 4),
            "duration_s": round(self.duration_s, 4),
            "speaker": self.speaker,
            "transcript": self.transcript.as_dict() if self.transcript else None,
            "phones": self.phones,
            "scores": self.scores,
            "state": self.state.value,
            "gates": [
                {"name": g.name, "passed": g.passed, "value": g.value,
                 "threshold": g.threshold, "severity": g.severity,
                 "detail": g.detail}
                for g in self.gates
            ],
        }
