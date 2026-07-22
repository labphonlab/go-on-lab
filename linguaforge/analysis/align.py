"""Forced alignment (第1層 2.), via Montreal Forced Aligner (english_mfa).

Real path: shells out to the `mfa align` CLI (assumes MFA + the english_mfa
acoustic model / dictionary are installed, per AGENTS.md) and reads back the
word-tier TextGrid to get per-item timestamps.

Fallback path: when `mfa` isn't on PATH, or alignment fails for a section,
items get evenly-divided timestamps across the audio's duration and are
flagged with alignment_confidence=0.0 so report.md surfaces them for human
review, per AGENTS.md's "低信頼度区間は必ずreport.mdに列挙" requirement.
This keeps the pipeline runnable (and its samples/ E2E test green) on
machines that don't have the multi-GB MFA models installed.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path

from .schema import AudioRef

ACOUSTIC_MODEL = "english_mfa"
DICTIONARY = "english_mfa"


@dataclass
class AlignedItem:
    audio: AudioRef | None
    confidence: float | None  # None = no audio at all; 0.0..1.0 otherwise


def _wav_duration_seconds(path: Path) -> float | None:
    if path.suffix.lower() != ".wav":
        return None
    try:
        with wave.open(str(path), "rb") as w:
            return w.getnframes() / float(w.getframerate())
    except (wave.Error, EOFError, OSError):
        return None


def _parse_textgrid_word_tier(textgrid_path: Path) -> list[tuple[float, float, str]]:
    """Minimal Praat long-format TextGrid reader for the 'words' tier.
    Avoids a praatio/textgrid dependency for a handful of interval lines."""
    content = textgrid_path.read_text(encoding="utf-8")
    tiers = re.split(r'name = "', content)[1:]
    for tier in tiers:
        name = tier.split('"', 1)[0]
        if name != "words":
            continue
        intervals = []
        for m in re.finditer(
            r'xmin = ([\d.]+)\s*\n\s*xmax = ([\d.]+)\s*\n\s*text = "([^"]*)"',
            tier,
        ):
            xmin, xmax, text = m.groups()
            if text.strip():
                intervals.append((float(xmin), float(xmax), text.strip()))
        return intervals
    return []


def _run_mfa(corpus_dir: Path, out_dir: Path) -> None:
    subprocess.run(
        ["mfa", "align", "--clean", "--quiet", str(corpus_dir), DICTIONARY, ACOUSTIC_MODEL, str(out_dir)],
        check=True,
        capture_output=True,
        text=True,
        timeout=600,
    )


def align_section_items(
    section_id: str,
    audio_dir: Path,
    audio_file: str | None,
    item_texts: list[str],
    work_dir: Path,
) -> tuple[list[AlignedItem], list[str]]:
    """Returns (per-item alignment, warnings-for-report)."""
    warnings: list[str] = []

    if audio_file is None or not item_texts:
        return [AlignedItem(audio=None, confidence=None) for _ in item_texts], (
            [f"section {section_id}: no matching audio file — items have no timestamps"] if item_texts else []
        )

    audio_path = audio_dir / audio_file
    duration = _wav_duration_seconds(audio_path)

    mfa_available = shutil.which("mfa") is not None
    if mfa_available:
        try:
            corpus_dir = work_dir / "mfa_corpus" / section_id
            corpus_dir.mkdir(parents=True, exist_ok=True)
            stem = Path(audio_file).stem
            shutil.copy(audio_path, corpus_dir / audio_file)
            (corpus_dir / f"{stem}.lab").write_text(" ".join(item_texts), encoding="utf-8")

            out_dir = work_dir / "mfa_out" / section_id
            _run_mfa(corpus_dir, out_dir)

            textgrid_path = out_dir / f"{stem}.TextGrid"
            word_intervals = _parse_textgrid_word_tier(textgrid_path)
            if word_intervals:
                return _map_words_to_items(item_texts, word_intervals, audio_file), warnings
            warnings.append(f"section {section_id}: MFA produced no word intervals — falling back to even split")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
            warnings.append(f"section {section_id}: MFA alignment failed ({e}) — falling back to even split")
    else:
        warnings.append(f"section {section_id}: MFA not installed — falling back to even split (low confidence)")

    return _even_split_fallback(item_texts, audio_file, duration), warnings


def _map_words_to_items(
    item_texts: list[str], word_intervals: list[tuple[float, float, str]], audio_file: str
) -> list[AlignedItem]:
    """Greedily consume word intervals in order, one item's word-count at a time."""
    results = []
    cursor = 0
    for text in item_texts:
        n_words = max(1, len(text.split()))
        span = word_intervals[cursor : cursor + n_words]
        if not span:
            results.append(AlignedItem(audio=None, confidence=0.0))
            continue
        start = span[0][0]
        end = span[-1][1]
        results.append(AlignedItem(audio=AudioRef(file=audio_file, start=start, end=end), confidence=1.0))
        cursor += n_words
    return results


def _even_split_fallback(item_texts: list[str], audio_file: str, duration: float | None) -> list[AlignedItem]:
    if duration is None:
        return [AlignedItem(audio=None, confidence=0.0) for _ in item_texts]
    n = len(item_texts)
    slice_len = duration / n
    results = []
    for i in range(n):
        start = i * slice_len
        end = (i + 1) * slice_len
        results.append(AlignedItem(audio=AudioRef(file=audio_file, start=start, end=end), confidence=0.0))
    return results
