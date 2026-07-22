"""Text-structure input (第1層 1.) — turns input/text/*.md into raw sections
paired with their input/audio/*.wav counterpart by filename stem.

One text file == one section, per AGENTS.md's `01_intro.md <-> 01_intro.wav`
convention. Phase 1 only reads Markdown/plain text; docx is a later
priority (python-docx would slot in here behind the same return shape).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

TEXT_EXTENSIONS = (".md", ".markdown", ".txt")
AUDIO_EXTENSIONS = (".wav", ".mp3")


@dataclass
class RawSection:
    id: str
    title: str
    body: str
    source_file: str
    audio_file: str | None


def _first_heading(body: str, fallback: str) -> str:
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return re.sub(r"^#+\s*", "", stripped).strip()
    return fallback


def _find_audio(stem: str, audio_dir: Path) -> str | None:
    if not audio_dir.exists():
        return None
    for ext in AUDIO_EXTENSIONS:
        candidate = audio_dir / f"{stem}{ext}"
        if candidate.exists():
            return candidate.name
    return None


def load_sections(text_dir: Path, audio_dir: Path) -> list[RawSection]:
    text_dir = Path(text_dir)
    audio_dir = Path(audio_dir)

    files = sorted(
        p for p in text_dir.iterdir()
        if p.is_file() and p.suffix.lower() in TEXT_EXTENSIONS
    )
    if not files:
        raise FileNotFoundError(f"No input text files ({TEXT_EXTENSIONS}) found in {text_dir}")

    sections = []
    for path in files:
        stem = path.stem
        body = path.read_text(encoding="utf-8")
        section_id = re.match(r"^(\d+)", stem)
        sections.append(
            RawSection(
                id=section_id.group(1) if section_id else stem,
                title=_first_heading(body, fallback=stem),
                body=body,
                source_file=path.name,
                audio_file=_find_audio(stem, audio_dir),
            )
        )
    return sections
