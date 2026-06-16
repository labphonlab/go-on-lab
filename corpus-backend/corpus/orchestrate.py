"""End-to-end corpus run: acquire → annotate → profile/report → export.

Ties the stages into one callable so a whole corpus can be produced and assessed
in a single step. The defaults use the zero-dependency baselines (so it runs
anywhere); inject real components (WhisperX, MFA, network sources) for production.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from .acquisition.registry import AcquisitionRegistry
from .acquisition.adapters.local_dir import LocalDirectorySource
from .annotation.orchestrator import AnnotationPipeline
from .annotation import manifest as ann_manifest
from .analysis.profile import profile_corpus
from .analysis.vowel_space import measure_segment_vowels, analyze_vowel_space
from .analysis.report import QualityReport, render_report
from .audio.wav import read_wav
from . import export as exporters


@dataclass
class RunResult:
    n_acquired: int
    n_segments: int
    report: QualityReport
    out_dir: str
    export_counts: dict = field(default_factory=dict)


def run_corpus(audio_dir: str, out_dir: str, *, language: str = "en",
               pipeline: AnnotationPipeline | None = None,
               measure_vowels: bool = True,
               do_export: bool = True) -> RunResult:
    """Acquire WAVs from ``audio_dir``, annotate, assess, and export under ``out_dir``."""
    os.makedirs(out_dir, exist_ok=True)
    pipeline = pipeline or AnnotationPipeline()

    # 1. Acquire (provenance + content-hash dedup).
    reg = AcquisitionRegistry(os.path.join(out_dir, "store"))
    acquired = reg.acquire_from(LocalDirectorySource(audio_dir, language=language))

    # 2. Annotate each acquired recording.
    all_segments = []
    wav_by_source = {}
    for a in acquired:
        wav = read_wav(a.local_path)
        wav_by_source[a.item_id] = wav
        all_segments.extend(pipeline.annotate(wav, source_id=a.item_id,
                                              declared_language=language))

    # 3. Persist segments + assess.
    ann_manifest.write_segments_jsonl(all_segments,
                                      os.path.join(out_dir, "segments.jsonl"))
    profile = profile_corpus(all_segments)

    vowel_space = None
    if measure_vowels:
        measurements = []
        for seg in all_segments:
            wav = wav_by_source.get(seg.source_id)
            if wav is not None:
                measurements.extend(measure_segment_vowels(wav, seg))
        if measurements:
            vowel_space = analyze_vowel_space(measurements, language=language)

    report = QualityReport(profile=profile, vowel_space=vowel_space)
    with open(os.path.join(out_dir, "QUALITY_REPORT.md"), "w", encoding="utf-8") as fh:
        fh.write(render_report(report))

    # 4. Export to research formats.
    export_counts = {}
    if do_export:
        export_counts = exporters.export_all(
            all_segments, os.path.join(out_dir, "export"),
            media_dir=os.path.join(out_dir, "store", "audio"))

    return RunResult(n_acquired=len(acquired), n_segments=len(all_segments),
                     report=report, out_dir=out_dir, export_counts=export_counts)
