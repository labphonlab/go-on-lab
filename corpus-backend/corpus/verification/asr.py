"""ASR-backed content verifier (optional, production path).

This is the drop-in replacement for the heuristic baseline. It is intentionally
import-light: faster-whisper is only imported when the verifier is constructed,
so the core package keeps zero hard dependencies.

    pip install faster-whisper

Then:

    from corpus.verification.asr import WhisperVerifier
    verifier = WhisperVerifier(model_size="small")

and pass it to the pipeline. The CER it produces feeds the content gate in
docs/QUALITY_STANDARDS.md.
"""

from __future__ import annotations

from .base import PromptVerifier, VerificationResult
from ..models import Prompt
from ..audio.wav import WavData


def _cer(reference: str, hypothesis: str) -> float:
    """Character error rate via Levenshtein distance, normalised by ref length."""
    ref = list(reference.strip())
    hyp = list(hypothesis.strip())
    if not ref:
        return 0.0 if not hyp else 1.0
    prev = list(range(len(hyp) + 1))
    for i, rc in enumerate(ref, 1):
        cur = [i]
        for j, hc in enumerate(hyp, 1):
            cost = 0 if rc == hc else 1
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost))
        prev = cur
    return prev[-1] / len(ref)


class WhisperVerifier(PromptVerifier):
    def __init__(self, model_size: str = "small", device: str = "cpu") -> None:
        # Imported lazily so importing this module never forces the dependency.
        from faster_whisper import WhisperModel  # type: ignore

        self._model = WhisperModel(model_size, device=device)

    def verify(self, wav: WavData, prompt: Prompt) -> VerificationResult:
        # faster-whisper reads from a path/array; integration left for M2 where
        # we standardise on feeding the decoded samples directly.
        raise NotImplementedError(
            "Wire decoded samples into faster-whisper transcribe() in M2; "
            "_cer() above already implements the scoring."
        )
