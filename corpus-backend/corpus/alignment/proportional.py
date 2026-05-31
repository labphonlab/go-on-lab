"""Baseline aligner (no ML dependency).

Distributes prompt tokens across the speech region proportionally to token
character length, after trimming leading/trailing silence. Every span is marked
``is_estimate=True``. This gives a usable first-pass segmentation for browsing
and bootstrapping, and is replaced by MFA/whisperX in M3 for phone accuracy.
"""

from __future__ import annotations

import math

from .base import ForcedAligner, TokenAlignment
from ..models import Prompt
from ..audio.wav import WavData


class ProportionalAligner(ForcedAligner):
    def __init__(self, silence_floor_dbfs: float = -50.0, win_s: float = 0.03):
        self.silence_floor = silence_floor_dbfs
        self.win_s = win_s

    def _speech_bounds(self, wav: WavData) -> tuple[float, float]:
        win = max(1, int(wav.sample_rate * self.win_s))
        s = wav.samples
        first = None
        last = None
        for idx, start in enumerate(range(0, len(s), win)):
            chunk = s[start:start + win]
            if not chunk:
                break
            energy = sum(x * x for x in chunk) / len(chunk)
            db = 10.0 * math.log10(energy) if energy > 1e-12 else float("-inf")
            if db >= self.silence_floor:
                if first is None:
                    first = idx
                last = idx
        if first is None:
            return 0.0, wav.duration_s
        win_s = win / wav.sample_rate
        return first * win_s, min(wav.duration_s, (last + 1) * win_s)

    def align(self, wav: WavData, prompt: Prompt) -> list[TokenAlignment]:
        tokens = prompt.text.split()
        if not tokens or wav.duration_s <= 0:
            return []
        start, end = self._speech_bounds(wav)
        span = max(1e-6, end - start)
        weights = [max(1, len(t)) for t in tokens]
        total = sum(weights)
        out: list[TokenAlignment] = []
        cursor = start
        for tok, w in zip(tokens, weights):
            dur = span * (w / total)
            out.append(TokenAlignment(tok, cursor, cursor + dur, is_estimate=True))
            cursor += dur
        return out
