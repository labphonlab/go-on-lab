"""Pipeline orchestration and acceptance gating.

Runs a submission through: validate -> audio QC -> verify -> align -> enrich
provenance, recording every gate result so the decision is fully reproducible.
"""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass

from ..models import (
    ConsentRecord, CorpusItem, GateResult, ItemState, License, Prompt,
    Provenance, Recording,
)
from ..audio.wav import read_wav, UnsupportedAudioError
from ..audio.quality import QCThresholds, compute_metrics, evaluate
from ..verification.base import PromptVerifier
from ..verification.heuristic import HeuristicVerifier
from ..alignment.base import ForcedAligner
from ..alignment.proportional import ProportionalAligner

PIPELINE_VERSION = "0.1.0"


@dataclass
class AcceptancePolicy:
    thresholds: QCThresholds = None  # type: ignore[assignment]
    max_cer: float = 0.15            # content gate (only applied if CER known)
    require_consent: bool = True

    def __post_init__(self):
        if self.thresholds is None:
            self.thresholds = QCThresholds()


class Pipeline:
    def __init__(
        self,
        policy: AcceptancePolicy | None = None,
        verifier: PromptVerifier | None = None,
        aligner: ForcedAligner | None = None,
    ) -> None:
        self.policy = policy or AcceptancePolicy()
        self.verifier = verifier or HeuristicVerifier()
        self.aligner = aligner or ProportionalAligner()

    def process(
        self,
        recording: Recording,
        prompt: Prompt,
        consent: ConsentRecord,
        corpus_license: License,
    ) -> CorpusItem:
        prov = Provenance(
            pipeline_version=PIPELINE_VERSION,
            consent_id=consent.consent_id,
            consent_version=consent.version,
        )
        item = CorpusItem(
            recording=recording, prompt=prompt, consent=consent,
            corpus_license=corpus_license, provenance=prov,
        )

        # --- Stage 1: structural / consent validation -----------------------
        if self.policy.require_consent and not consent.is_active():
            item.gates.append(GateResult(
                "consent_active", False, severity="hard",
                detail="consent missing, withdrawn, or past retention"))
            item.decide()
            return self._finalise(item)
        item.gates.append(GateResult("consent_active", True, severity="hard"))

        # --- Stage 2: audio QC ----------------------------------------------
        try:
            wav = read_wav(recording.audio_path)
        except (FileNotFoundError, UnsupportedAudioError, EOFError) as exc:
            item.gates.append(GateResult(
                "audio_readable", False, severity="hard", detail=str(exc)))
            item.decide()
            return self._finalise(item)
        item.gates.append(GateResult("audio_readable", True, severity="hard"))

        recording.sample_rate = wav.sample_rate
        recording.channels = wav.channels
        recording.bit_depth = wav.bit_depth
        recording.duration_s = wav.duration_s

        metrics = compute_metrics(wav)
        item.qc_metrics = metrics.as_dict()
        item.gates.extend(evaluate(metrics, self.policy.thresholds))

        # --- Stage 3: content verification ----------------------------------
        vr = self.verifier.verify(wav, prompt)
        item.verification = vr.as_dict()
        if vr.cer is not None:
            item.gates.append(GateResult(
                "read_correctly", vr.cer <= self.policy.max_cer, value=vr.cer,
                threshold=f"CER <= {self.policy.max_cer}", severity="soft"))
        if vr.language_match is False:
            item.gates.append(GateResult(
                "language_match", False, severity="soft",
                detail="detected language != declared"))

        # --- Stage 4: forced alignment --------------------------------------
        item.alignment = [a.as_dict() for a in self.aligner.align(wav, prompt)]

        # --- Stage 5: provenance finalise + decision ------------------------
        prov.processed_at = _dt.datetime.now(_dt.timezone.utc).isoformat()
        item.decide()
        return self._finalise(item)

    @staticmethod
    def _finalise(item: CorpusItem) -> CorpusItem:
        if item.state == ItemState.PENDING:
            item.decide()
        return item
