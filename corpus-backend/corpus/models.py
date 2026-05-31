"""Typed domain model for the corpus backend.

Pure standard library (dataclasses + enums) so the core has zero dependencies
and runs identically everywhere. Every artefact that can end up in a sellable
dataset carries explicit consent, licensing and provenance.
"""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional


def _utcnow() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


class ItemState(str, Enum):
    """Terminal pipeline state for a corpus item."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REVIEW = "review"
    REJECTED = "rejected"


class License(str, Enum):
    """Distribution licence of the *corpus* (distinct from speaker consent)."""

    CC0_1_0 = "CC0-1.0"
    CC_BY_4_0 = "CC-BY-4.0"
    CC_BY_SA_4_0 = "CC-BY-SA-4.0"
    CC_BY_NC_4_0 = "CC-BY-NC-4.0"  # non-commercial: NOT sellable
    COMMERCIAL_EULA = "Commercial-EULA"

    @property
    def permits_commercial(self) -> bool:
        return self not in {License.CC_BY_NC_4_0}


@dataclass
class ConsentRecord:
    """What the *speaker* granted, captured at recording time and immutable."""

    consent_id: str
    speaker_id: str
    version: str  # version of the consent wording the speaker agreed to
    commercial_use: bool
    redistribution: bool
    derivatives: bool
    jurisdiction: str = "JP"  # GDPR / JP-APPI / CCPA ...
    lawful_basis: str = "consent"
    retention_until: Optional[str] = None  # ISO date; None = indefinite
    withdrawn: bool = False
    granted_at: str = field(default_factory=_utcnow)

    def is_active(self, on: Optional[str] = None) -> bool:
        """True if consent is currently valid (not withdrawn, within retention)."""
        if self.withdrawn:
            return False
        if self.retention_until is not None:
            on = on or _utcnow()
            if on > self.retention_until:
                return False
        return True


@dataclass
class Speaker:
    """Pseudonymous speaker. No directly identifying data is stored here."""

    speaker_id: str
    native_language: Optional[str] = None  # BCP-47, e.g. "ja", "en"
    l2_languages: list[str] = field(default_factory=list)
    age_band: Optional[str] = None  # e.g. "20-29"
    sex: Optional[str] = None
    region: Optional[str] = None


@dataclass
class Prompt:
    """A script to be read. Text rights live here, separate from speaker rights."""

    prompt_id: str
    language: str  # BCP-47
    text: str
    text_license: License = License.CC0_1_0  # public-domain / authored prompts
    domain: Optional[str] = None  # e.g. "news", "conversational"

    def token_count(self) -> int:
        return len(self.text.split())


@dataclass
class Provenance:
    """Audit trail attached to every accepted item — needed for a sellable set."""

    collector: str = "go-on-lab"
    pipeline_version: str = "0.1.0"
    consent_id: Optional[str] = None
    consent_version: Optional[str] = None
    capture_device: Optional[str] = None
    capture_environment: Optional[str] = None
    ingested_at: str = field(default_factory=_utcnow)
    processed_at: Optional[str] = None


@dataclass
class GateResult:
    """Outcome of a single quality gate, retained for reproducibility."""

    name: str
    passed: bool
    value: Optional[float] = None
    threshold: Optional[str] = None
    severity: str = "hard"  # "hard" -> reject, "soft" -> review
    detail: Optional[str] = None


@dataclass
class Recording:
    """An audio submission referencing the prompt it was meant to read."""

    recording_id: str
    prompt_id: str
    speaker_id: str
    audio_path: str
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    bit_depth: Optional[int] = None
    duration_s: Optional[float] = None


@dataclass
class CorpusItem:
    """The unit produced by the pipeline: a verified, aligned, licensed clip."""

    recording: Recording
    prompt: Prompt
    consent: ConsentRecord
    corpus_license: License
    state: ItemState = ItemState.PENDING
    provenance: Provenance = field(default_factory=Provenance)
    gates: list[GateResult] = field(default_factory=list)
    qc_metrics: dict = field(default_factory=dict)
    verification: dict = field(default_factory=dict)
    alignment: list = field(default_factory=list)  # list of token timings
    pseudonymised: bool = True

    # -- decision helpers ---------------------------------------------------

    def failed_hard(self) -> list[GateResult]:
        return [g for g in self.gates if not g.passed and g.severity == "hard"]

    def failed_soft(self) -> list[GateResult]:
        return [g for g in self.gates if not g.passed and g.severity == "soft"]

    def decide(self) -> ItemState:
        """Derive the terminal state from recorded gate results."""
        if self.failed_hard():
            self.state = ItemState.REJECTED
        elif self.failed_soft():
            self.state = ItemState.REVIEW
        else:
            self.state = ItemState.ACCEPTED
        return self.state

    def is_sellable(self, on: Optional[str] = None) -> bool:
        """Enforce the chain-of-rights rule from docs/LICENSING.md."""
        return (
            self.state == ItemState.ACCEPTED
            and self.consent.is_active(on)
            and self.consent.commercial_use
            and self.consent.redistribution
            and self.corpus_license.permits_commercial
        )

    def to_dict(self) -> dict:
        d = asdict(self)
        d["state"] = self.state.value
        d["corpus_license"] = self.corpus_license.value
        d["prompt"]["text_license"] = self.prompt.text_license.value
        d["sellable"] = self.is_sellable()
        return d
