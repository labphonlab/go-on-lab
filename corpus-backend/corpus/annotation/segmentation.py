"""Intersect VAD speech regions with diarization turns.

Produces speaker-homogeneous speech spans: the unit we transcribe and store.
A speech region spanning two speakers is split at the speaker boundary so no
segment mixes speakers (which would corrupt per-speaker analysis).
"""

from __future__ import annotations

from .models import SpeechRegion, SpeakerTurn


def intersect(regions: list[SpeechRegion],
              turns: list[SpeakerTurn],
              min_s: float = 0.3) -> list[tuple[float, float, str]]:
    """Return (start, end, speaker) spans where speech and a turn overlap."""
    spans: list[tuple[float, float, str]] = []
    for r in regions:
        for t in turns:
            start = max(r.start_s, t.start_s)
            end = min(r.end_s, t.end_s)
            if end - start >= min_s:
                spans.append((start, end, t.speaker))
    spans.sort(key=lambda x: x[0])
    return spans
