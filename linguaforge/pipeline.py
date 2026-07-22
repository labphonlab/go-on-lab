#!/usr/bin/env python3
"""LinguaForge pipeline — turns input/{text,audio,config.yaml} into a
generated learning-app in output/{app,data,report.md}.

    python pipeline.py --input ./input --output ./output --lang en

See AGENTS.md for the full architecture and README.md for current scope.
"""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from pathlib import Path

import yaml

_SINGLE_WORD_RE = re.compile(r"[A-Za-z']+")


def _as_single_word(text: str) -> str | None:
    """Returns the word if `text` is exactly one alphabetic token (ND is a
    word-level metric, not defined for a whole sentence), else None."""
    stripped = text.strip()
    return stripped if _SINGLE_WORD_RE.fullmatch(stripped) else None

from analysis.align import align_section_items
from analysis.classify import DEFAULT_MODEL, build_classifier
from analysis.difficulty import flag_item
from analysis.generator import generate_app
from analysis.parser import load_sections
from analysis.priority import order_by_priority, score_item, word_neighborhood_density
from analysis.report import write_report
from analysis.schema import Course, Item, Section


def load_config(input_dir: Path, cli_lang: str | None) -> dict:
    config_path = input_dir / "config.yaml"
    config = {}
    if config_path.exists():
        config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    config.setdefault("title", "Untitled Course")
    config.setdefault("level", "unspecified")
    config.setdefault("lang", cli_lang or "en")
    if cli_lang:
        config["lang"] = cli_lang
    return config


def run_pipeline(input_dir: Path, output_dir: Path, lang: str | None, mock: bool, model: str | None) -> Course:
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)
    text_dir = input_dir / "text"
    audio_dir = input_dir / "audio"

    config = load_config(input_dir, lang)
    if config["lang"] != "en":
        raise NotImplementedError(
            f"lang={config['lang']!r} is not implemented yet — phase 1 covers English only "
            f"(Korean is phase 3, per AGENTS.md)."
        )

    raw_sections = load_sections(text_dir, audio_dir)
    classifier = build_classifier(mock=mock, model=model or DEFAULT_MODEL)

    course = Course(
        title=config["title"],
        level=config["level"],
        lang=config["lang"],
        source_files=[s.source_file for s in raw_sections],
    )

    all_warnings: list[str] = []
    oov_words: set[str] = set()

    with tempfile.TemporaryDirectory(prefix="linguaforge_work_") as work_dir_str:
        work_dir = Path(work_dir_str)

        for raw in raw_sections:
            analysis = classifier.classify(raw, lang=config["lang"])

            item_texts = [it["text"] for it in analysis.items]
            aligned, warnings = align_section_items(
                section_id=raw.id,
                audio_dir=audio_dir,
                audio_file=raw.audio_file,
                item_texts=item_texts,
                work_dir=work_dir,
            )
            all_warnings.extend(warnings)

            built = []
            for raw_item, aligned_item in zip(analysis.items, aligned):
                flags = flag_item(raw_item["text"], raw_item.get("ipa", ""))
                score = score_item(raw_item["text"], flags)
                built.append((raw_item, aligned_item, flags, score))

            order = order_by_priority(analysis.content_type, [(i, b[3]) for i, b in enumerate(built)])

            items = []
            for idx, src_idx in enumerate(order, start=1):
                raw_item, aligned_item, flags, score = built[src_idx]

                nd = nd_l1 = None
                word = _as_single_word(raw_item["text"])
                if word is not None:
                    nd, nd_l1 = word_neighborhood_density(word)
                    if nd is None:
                        oov_words.add(word.lower())

                items.append(
                    Item(
                        id=f"{raw.id}-{idx:03d}",
                        text=raw_item["text"],
                        ja=raw_item.get("ja", ""),
                        ipa=raw_item.get("ipa", ""),
                        pos=raw_item.get("pos", ""),
                        speaker=raw_item.get("speaker", ""),
                        audio=aligned_item.audio,
                        difficulty_flags=flags,
                        alignment_confidence=aligned_item.confidence,
                        priority_score=score,
                        nd=nd,
                        nd_l1_weighted=nd_l1,
                    )
                )

            course.sections.append(
                Section(
                    id=raw.id,
                    title=raw.title,
                    content_type=analysis.content_type,
                    learning_methods=analysis.learning_methods,
                    rationale=analysis.rationale,
                    items=items,
                )
            )

    output_dir.mkdir(parents=True, exist_ok=True)
    generate_app(course, output_dir, audio_dir=audio_dir)
    write_report(course, all_warnings, output_dir, oov_words=sorted(oov_words))

    return course


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="LinguaForge: generate a learning app from text + audio.")
    parser.add_argument("--input", default="./input", help="input directory (text/, audio/, config.yaml)")
    parser.add_argument("--output", default="./output", help="output directory (app/, data/, report.md)")
    parser.add_argument("--lang", default=None, choices=["en", "ko"], help="override config.yaml lang")
    parser.add_argument("--model", default=None, help="Claude model id override")
    parser.add_argument(
        "--mock", action="store_true",
        help="use the offline heuristic classifier instead of the Claude API (no ANTHROPIC_API_KEY needed)",
    )
    args = parser.parse_args(argv)

    try:
        course = run_pipeline(Path(args.input), Path(args.output), args.lang, args.mock, args.model)
    except (FileNotFoundError, NotImplementedError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    total_items = sum(len(s.items) for s in course.sections)
    print(f"Generated {len(course.sections)} sections / {total_items} items -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
