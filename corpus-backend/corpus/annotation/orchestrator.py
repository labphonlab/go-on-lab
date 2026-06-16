"""Annotation pipeline orchestrator.

Drives: normalise -> VAD segment -> diarize -> intersect -> transcribe ->
(optional phone align) -> confidence gate, producing scored, decided segments.

Heavy ML is injected via the stage interfaces; the default construction uses the
zero-dependency baselines so the whole thing runs and is tested without GPUs.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .base import Segmenter, Diarizer, Transcriber
from .baselines import EnergySegmenter, NullDiarizer, NullTranscriber
from .models import Segment, Transcript
from .segmentation import intersect
from ..audio.wav import WavData, read_wav, UnsupportedAudioError
from ..audio.quality import _dbfs  # reuse the dBFS helper
from ..models import GateResult, ItemState

PIPELINE_VERSION = "0.1.0"


def _segment_snr_db(wav: WavData, start_s: float, end_s: float,
                    win_s: float = 0.03) -> float:
    """Per-segment SNR via loud-vs-quiet window levels (same heuristic as QC)."""
    sr = wav.sample_rate
    a = max(0, int(start_s * sr))
    b = min(len(wav.samples), int(end_s * sr))
    seg = wav.samples[a:b]
    if len(seg) < 4:
        return 0.0
    win = max(1, int(sr * win_s))
    levels = []
    for start in range(0, len(seg), win):
        chunk = seg[start:start + win]
        if not chunk:
            continue
        rms = math.sqrt(sum(x * x for x in chunk) / len(chunk))
        db = _dbfs(rms)
        levels.append(-120.0 if math.isinf(db) else db)
    if len(levels) < 4:
        return 0.0
    levels.sort()
    k = max(1, len(levels) // 10)
    noise = sum(levels[:k]) / k
    speech = sum(levels[-k:]) / k
    return speech - noise


@dataclass
class AnnotationPolicy:
    min_duration_s: float = 0.3
    max_duration_s: float = 30.0
    min_snr_db: float = 15.0
    min_asr_confidence: float = 0.6
    require_transcript: bool = True  # accept needs a real transcript


def gate_segment(seg: Segment, tr: Transcript, policy: AnnotationPolicy,
                 declared_language: str | None = None) -> None:
    """Append the standard quality gates to ``seg`` (shared by all pipelines).

    Kept as a free function so the WhisperX whole-file path and the staged
    baseline path apply identical gating and decisions.
    """
    p = policy

    seg.gates.append(GateResult(
        "duration_s", p.min_duration_s <= seg.duration_s <= p.max_duration_s,
        value=round(seg.duration_s, 3),
        threshold=f"{p.min_duration_s}..{p.max_duration_s}", severity="hard"))

    snr = seg.scores.get("snr_db", 0.0)
    seg.gates.append(GateResult(
        "snr_db", snr >= p.min_snr_db, value=snr,
        threshold=f">= {p.min_snr_db}", severity="soft"))

    # Transcript presence: no real label -> review, never silent accept.
    has_text = bool(tr.text) and not tr.is_heuristic
    if p.require_transcript:
        seg.gates.append(GateResult(
            "transcript_present", has_text, severity="soft",
            detail="no ASR transcript (baseline)" if not has_text else ""))

    if tr.confidence is not None:
        seg.gates.append(GateResult(
            "asr_confidence", tr.confidence >= p.min_asr_confidence,
            value=round(tr.confidence, 4),
            threshold=f">= {p.min_asr_confidence}", severity="soft"))

    if declared_language and tr.language and tr.language != declared_language:
        seg.gates.append(GateResult(
            "language_match", False, severity="soft",
            detail=f"detected {tr.language} != declared {declared_language}"))


class AnnotationPipeline:
    def __init__(
        self,
        segmenter: Segmenter | None = None,
        diarizer: Diarizer | None = None,
        transcriber: Transcriber | None = None,
        policy: AnnotationPolicy | None = None,
    ) -> None:
        self.segmenter = segmenter or EnergySegmenter()
        self.diarizer = diarizer or NullDiarizer()
        self.transcriber = transcriber or NullTranscriber()
        self.policy = policy or AnnotationPolicy()

    def annotate_file(self, audio_path: str, source_id: str | None = None,
                      declared_language: str | None = None) -> list[Segment]:
        wav = read_wav(audio_path)
        return self.annotate(wav, source_id or audio_path, declared_language)

    def annotate(self, wav: WavData, source_id: str,
                 declared_language: str | None = None) -> list[Segment]:
        regions = self.segmenter.segment(wav)
        turns = self.diarizer.diarize(wav)
        spans = intersect(regions, turns, self.policy.min_duration_s)

        segments: list[Segment] = []
        for i, (start, end, speaker) in enumerate(spans):
            seg = Segment(
                segment_id=f"{source_id}#{i:04d}",
                source_id=source_id, start_s=start, end_s=end, speaker=speaker,
            )
            tr = self.transcriber.transcribe(wav, start, end, declared_language)
            seg.transcript = tr
            seg.scores["snr_db"] = round(_segment_snr_db(wav, start, end), 2)
            if tr.confidence is not None:
                seg.scores["asr_confidence"] = round(tr.confidence, 4)
            self._gate(seg, tr, declared_language)
            seg.decide()
            segments.append(seg)
        return segments

    def _gate(self, seg: Segment, tr: Transcript,
              declared_language: str | None) -> None:
        gate_segment(seg, tr, self.policy, declared_language)
