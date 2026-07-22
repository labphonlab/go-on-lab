#!/usr/bin/env python3
"""Convert content/units/unitNN/{unit.yaml,sections/*.md} into the
LinguaForge-compatible app export JSON described in CLAUDE.md section 6.2.

This bypasses LinguaForge's classify.py -- each section's `type` and
`app_components` in unit.yaml explicitly declare which component(s) to
emit, so no content classification/inference step is needed.

Usage:
    python3 scripts/export_app.py --unit 1
    python3 scripts/export_app.py --all
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTENT_DIR = REPO_ROOT / "content"
DEFAULT_BUILD_DIR = REPO_ROOT / "build" / "app-export"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
DIALOGUE_LINE_RE = re.compile(r"^\*\*(?P<speaker>[^:*]+):\*\*\s*(?P<line>.+)$", re.MULTILINE)
NUMBERED_CLOZE_RE = re.compile(
    r"^\d+\.\s+(?P<prompt>.+?)\s*→\s*\*\*(?P<answer>[^*]+)\*\*\s*$", re.MULTILINE
)


class ExportError(Exception):
    pass


def load_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def parse_frontmatter(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(raw)
    if not match:
        return {}, raw
    meta = yaml.safe_load(match.group(1)) or {}
    body = raw[match.end():]
    return meta, body


def load_vocabulary_for_unit(content_dir: Path, unit_num: int) -> list[dict]:
    path = content_dir / "vocabulary.csv"
    rows = []
    if not path.exists():
        return rows
    with path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            try:
                if int(row["unit"]) != unit_num:
                    continue
            except (KeyError, ValueError):
                continue
            rows.append(row)
    return rows


def build_flashcard_sm2(unit_num: int, vocab_rows: list[dict]) -> dict:
    items = []
    for idx, row in enumerate(vocab_rows, start=1):
        word_slug = re.sub(r"[^a-z0-9]+", "-", row["word"].lower()).strip("-")
        items.append(
            {
                "id": f"w-{unit_num:02d}-{idx:03d}-{word_slug}",
                "en": row["word"],
                "ja": row.get("ja", ""),
                "ipa": row.get("ipa", ""),
                "audio": f"audio/vocab/{word_slug}.mp3",
            }
        )
    return {"type": "flashcard_sm2", "items": items}


def build_shadowing(unit_num: int, section_id: str, meta: dict) -> dict:
    # A section can reuse another section's recorded audio (e.g. the
    # Fluency step shadows the Input dialogue rather than recording new
    # material -- per CLAUDE.md, Fluency drills must use "既習素材のみ").
    audio_section_id = meta.get("source_section", section_id)
    return {
        "type": "shadowing",
        "audio": f"audio/{audio_section_id}.mp3",
        "textgrid": f"audio/{audio_section_id}.TextGrid",
        "stages": 3,
    }


def build_dictation(unit_num: int, section_id: str, body: str) -> dict:
    items = []
    for idx, match in enumerate(DIALOGUE_LINE_RE.finditer(body), start=1):
        items.append(
            {
                "id": f"d-{unit_num:02d}-{section_id}-{idx:03d}",
                "speaker": match.group("speaker").strip(),
                "text": match.group("line").strip(),
                "audio": f"audio/{section_id}-line{idx:03d}.mp3",
            }
        )
    return {"type": "dictation", "items": items}


def build_cloze(unit_num: int, section_id: str, body: str) -> dict:
    items = []
    for idx, match in enumerate(NUMBERED_CLOZE_RE.finditer(body), start=1):
        items.append(
            {
                "id": f"c-{unit_num:02d}-{section_id}-{idx:03d}",
                "prompt": match.group("prompt").strip(),
                "answer": match.group("answer").strip(),
            }
        )
    return {"type": "cloze", "items": items}


def build_roleplay_ai(unit_num: int, section_id: str, meta: dict) -> dict:
    roleplay = meta.get("roleplay")
    if not roleplay:
        raise ExportError(
            f"unit {unit_num} section {section_id}: type=main_task with app_components "
            "including roleplay_ai must have a `roleplay:` block in frontmatter"
        )
    known_vocab_cap = roleplay.get("known_vocab_cap", f"unit_{unit_num:02d}")
    return {
        "type": "roleplay_ai",
        "scenario": (roleplay.get("scenario") or "").strip(),
        "ai_role": (roleplay.get("ai_role") or "").strip(),
        "learner_goal": (roleplay.get("learner_goal") or "").strip(),
        "known_vocab_cap": known_vocab_cap,
        "recast": bool(roleplay.get("recast", True)),
        "clarification_requests": bool(roleplay.get("clarification_requests", True)),
        "eval_rubric": (roleplay.get("eval_rubric") or "").strip(),
    }


def build_can_do_survey(unit_num: int, meta: dict) -> dict:
    survey = meta.get("can_do_survey") or []
    items = [{"id": item["id"], "ja": item["ja"]} for item in survey]
    return {"type": "can_do_survey", "items": items}


def build_pronunciation_assess(unit_num: int, vocab_rows: list[dict]) -> dict:
    targets = [row["word"] for row in vocab_rows]
    return {"type": "pronunciation_assess", "targets": targets}


def build_hvpt(unit_num: int, vocab_rows: list[dict], meta: dict) -> dict:
    hvpt_words = [row["word"] for row in vocab_rows if row.get("hvpt") == "1"]
    return {
        "type": "hvpt",
        "contrast": meta.get("hvpt_contrast", "unspecified"),
        "items": hvpt_words,
    }


COMPONENT_BUILDERS = {
    "shadowing": build_shadowing,
    "dictation": build_dictation,
    "cloze": build_cloze,
    "roleplay_ai": build_roleplay_ai,
    "can_do_survey": build_can_do_survey,
    "pronunciation_assess": build_pronunciation_assess,
    "hvpt": build_hvpt,
}


def export_unit(content_dir: Path, unit_dir: Path) -> dict:
    unit_yaml = load_yaml(unit_dir / "unit.yaml")
    unit_num = unit_yaml["unit"]
    vocab_rows = load_vocabulary_for_unit(content_dir, unit_num)

    components: list[dict] = []
    emitted_flashcards = False
    seen_shadowing_audio: set[str] = set()
    seen_dictation_sources: set[str] = set()

    for section in unit_yaml.get("sections", []):
        section_id = section["id"]
        app_components = section.get("app_components") or []
        if not app_components:
            continue

        section_path = unit_dir / "sections" / f"{section_id}.md"
        if not section_path.exists():
            raise ExportError(f"unit {unit_num}: missing section file {section_path}")
        meta, body = parse_frontmatter(section_path)

        # A section may point at another section's recorded audio/dialogue
        # instead of having its own (e.g. Fluency reusing Input's dialogue).
        source_section_id = meta.get("source_section", section_id)
        if source_section_id != section_id:
            source_path = unit_dir / "sections" / f"{source_section_id}.md"
            if not source_path.exists():
                raise ExportError(
                    f"unit {unit_num} section {section_id}: source_section "
                    f"'{source_section_id}' not found"
                )
            _, dictation_body = parse_frontmatter(source_path)
        else:
            dictation_body = body

        for component_name in app_components:
            if component_name == "karaoke_reader":
                # karaoke_reader is a paper+audio pairing handled client-side
                # from the shadowing audio/textgrid; no separate JSON block.
                continue
            if component_name == "flashcard_sm2":
                if not emitted_flashcards:
                    components.append(build_flashcard_sm2(unit_num, vocab_rows))
                    emitted_flashcards = True
                continue

            builder = COMPONENT_BUILDERS.get(component_name)
            if builder is None:
                raise ExportError(
                    f"unit {unit_num} section {section_id}: unknown app_component "
                    f"'{component_name}'"
                )
            if builder is build_shadowing:
                # Skip re-emitting a shadowing block for audio already
                # exported by an earlier section (e.g. Fluency reusing
                # Input's audio) -- the app resolves it once and reuses it.
                if source_section_id in seen_shadowing_audio:
                    continue
                components.append(builder(unit_num, section_id, meta))
                seen_shadowing_audio.add(source_section_id)
            elif builder is build_dictation:
                if source_section_id in seen_dictation_sources:
                    continue
                components.append(builder(unit_num, source_section_id, dictation_body))
                seen_dictation_sources.add(source_section_id)
            elif builder is build_cloze:
                components.append(builder(unit_num, section_id, body))
            elif builder is build_roleplay_ai:
                components.append(builder(unit_num, section_id, meta))
            elif builder is build_can_do_survey:
                components.append(builder(unit_num, meta))
            elif builder is build_pronunciation_assess:
                components.append(builder(unit_num, vocab_rows))
            elif builder is build_hvpt:
                components.append(builder(unit_num, vocab_rows, meta))

    # Vocabulary always gets a flashcard deck even if no section explicitly
    # lists flashcard_sm2, since SRS review is a standing app feature.
    if not emitted_flashcards and vocab_rows:
        components.insert(0, build_flashcard_sm2(unit_num, vocab_rows))

    return {"unit": unit_num, "components": components}


def discover_unit_dirs(content_dir: Path) -> list[Path]:
    units_dir = content_dir / "units"
    if not units_dir.exists():
        return []
    return sorted(
        (p for p in units_dir.iterdir() if p.is_dir() and (p / "unit.yaml").exists()),
        key=lambda p: p.name,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--content-dir", type=Path, default=DEFAULT_CONTENT_DIR)
    parser.add_argument("--build-dir", type=Path, default=DEFAULT_BUILD_DIR)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--unit", type=int, help="export a single unit number")
    group.add_argument("--all", action="store_true", help="export every unit with content")
    args = parser.parse_args(argv)

    args.build_dir.mkdir(parents=True, exist_ok=True)

    if args.unit is not None:
        unit_dirs = [args.content_dir / "units" / f"unit{args.unit:02d}"]
    else:
        unit_dirs = discover_unit_dirs(args.content_dir)

    exit_code = 0
    for unit_dir in unit_dirs:
        if not unit_dir.exists():
            print(f"ERROR: {unit_dir} does not exist", file=sys.stderr)
            exit_code = 1
            continue
        try:
            export = export_unit(args.content_dir, unit_dir)
        except ExportError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            exit_code = 1
            continue

        out_path = args.build_dir / f"unit-{export['unit']:02d}.json"
        out_path.write_text(
            json.dumps(export, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"wrote {out_path} ({len(export['components'])} components)")

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
