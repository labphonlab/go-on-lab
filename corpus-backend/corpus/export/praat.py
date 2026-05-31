"""Export segments to Praat TextGrid — the canonical phonetics annotation format.

Writes a standard (long-form) TextGrid with up to three interval tiers per
source recording: utterance text, words, and phones (whichever are available).
This is what a phonetician opens in Praat to inspect and measure the corpus.

Pure standard library. Round-trips with corpus.alignment.textgrid (the reader).
"""

from __future__ import annotations

import os

from ..annotation.models import Segment


def _fmt(x: float) -> str:
    return f"{x:.6f}"


def _interval_tier(name: str, intervals: list[tuple[float, float, str]],
                   xmin: float, xmax: float) -> list[str]:
    """Render one IntervalTier, filling gaps with empty intervals (Praat needs
    a fully tiled timeline with no overlaps or holes)."""
    filled: list[tuple[float, float, str]] = []
    cursor = xmin
    for start, end, text in sorted(intervals, key=lambda i: i[0]):
        start = max(start, cursor)
        if end <= start:
            continue
        if start > cursor:
            filled.append((cursor, start, ""))
        filled.append((start, end, text))
        cursor = end
    if cursor < xmax:
        filled.append((cursor, xmax, ""))
    if not filled:
        filled = [(xmin, xmax, "")]

    lines = [
        '    class = "IntervalTier"',
        f'    name = "{name}"',
        f"    xmin = {_fmt(xmin)}",
        f"    xmax = {_fmt(xmax)}",
        f"    intervals: size = {len(filled)}",
    ]
    for i, (start, end, text) in enumerate(filled, 1):
        esc = text.replace('"', '""')
        lines += [
            f"    intervals [{i}]:",
            f"        xmin = {_fmt(start)}",
            f"        xmax = {_fmt(end)}",
            f'        text = "{esc}"',
        ]
    return lines


def textgrid_for_source(segments: list[Segment]) -> str:
    """Build a TextGrid string covering all segments of one source recording."""
    if not segments:
        return ""
    xmin = min(s.start_s for s in segments)
    xmax = max(s.end_s for s in segments)

    utt = [(s.start_s, s.end_s, (s.transcript.text or "") if s.transcript else "")
           for s in segments]
    words: list[tuple[float, float, str]] = []
    phones: list[tuple[float, float, str]] = []
    for s in segments:
        if s.transcript:
            for w in s.transcript.words:
                words.append((w.start_s, w.end_s, w.word))
        for ph in s.phones:
            phones.append((ph["start_s"], ph["end_s"], ph["label"]))

    tiers = [("utterance", utt)]
    if words:
        tiers.append(("words", words))
    if phones:
        tiers.append(("phones", phones))

    body = [
        'File type = "ooTextFile"',
        'Object class = "TextGrid"',
        "",
        f"xmin = {_fmt(xmin)}",
        f"xmax = {_fmt(xmax)}",
        "tiers? <exists>",
        f"size = {len(tiers)}",
        "item []:",
    ]
    for idx, (name, intervals) in enumerate(tiers, 1):
        body.append(f"    item [{idx}]:")
        body += ["    " + ln for ln in _interval_tier(name, intervals, xmin, xmax)]
    return "\n".join(body) + "\n"


def export_textgrids(segments: list[Segment], out_dir: str) -> int:
    """Write one TextGrid per source recording. Returns the file count."""
    os.makedirs(out_dir, exist_ok=True)
    by_source: dict[str, list[Segment]] = {}
    for s in segments:
        by_source.setdefault(s.source_id, []).append(s)
    n = 0
    for source_id, segs in by_source.items():
        safe = source_id.replace("/", "__").replace("#", "_")
        path = os.path.join(out_dir, f"{safe}.TextGrid")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(textgrid_for_source(segs))
        n += 1
    return n
