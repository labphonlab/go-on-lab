#!/usr/bin/env python3
"""Build gate: verify each unit's Input sections reach >=98% vocabulary coverage.

Coverage is computed against a cumulative "known vocabulary" set: the
baseline vocabulary (content/baseline_vocabulary.txt, representing what a
learner already knows before Unit 1) plus every unit's vocabulary_targets,
accumulated in unit order up to and including the unit being checked.

Also cross-validates that each unit.yaml's vocabulary_targets are a subset
of the words registered for that unit in content/vocabulary.csv.

Usage:
    python3 scripts/vocab_check.py [--units-dir DIR] [--threshold 0.98]

Exit code 0 = all checked units pass; 1 = at least one unit failed a gate.
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTENT_DIR = REPO_ROOT / "content"

# Section types treated as meaning-focused Input and therefore subject to
# the 98% coverage gate. Language Focus / task sections intentionally are
# not gated -- they may use a small amount of illustrative vocabulary
# outside the controlled list, per CLAUDE.md section 9.
GATED_SECTION_TYPES = {"input_dialogue", "input_reading"}

WORD_RE = re.compile(r"[A-Za-z']+")
DIALOGUE_LINE_RE = re.compile(r"^\*\*[^:*]+:\*\*\s*(.+)$", re.MULTILINE)
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


@dataclass
class SectionCheckResult:
    unit: int
    section_id: str
    total_tokens: int
    unknown_tokens: list[str]

    @property
    def coverage(self) -> float:
        if self.total_tokens == 0:
            return 1.0
        known = self.total_tokens - len(self.unknown_tokens)
        return known / self.total_tokens

    def passed(self, threshold: float) -> bool:
        return self.coverage >= threshold


@dataclass
class UnitCheckResult:
    unit: int
    title: str
    sections: list[SectionCheckResult] = field(default_factory=list)
    vocab_csv_mismatches: list[str] = field(default_factory=list)

    def passed(self, threshold: float) -> bool:
        if self.vocab_csv_mismatches:
            return False
        return all(s.passed(threshold) for s in self.sections)


def load_baseline_vocabulary(content_dir: Path) -> set[str]:
    path = content_dir / "baseline_vocabulary.txt"
    words: set[str] = set()
    if not path.exists():
        return words
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        words.add(line.lower())
    return words


def load_vocabulary_csv(content_dir: Path) -> dict[int, set[str]]:
    """Return {unit_number: {word, ...}} from content/vocabulary.csv."""
    path = content_dir / "vocabulary.csv"
    by_unit: dict[int, set[str]] = {}
    if not path.exists():
        return by_unit
    with path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            try:
                unit_num = int(row["unit"])
            except (KeyError, ValueError):
                continue
            word = row["word"].strip().lower()
            by_unit.setdefault(unit_num, set()).add(word)
    return by_unit


def discover_units(content_dir: Path) -> list[Path]:
    units_dir = content_dir / "units"
    if not units_dir.exists():
        return []
    unit_dirs = sorted(
        (p for p in units_dir.iterdir() if p.is_dir() and (p / "unit.yaml").exists()),
        key=lambda p: p.name,
    )
    return unit_dirs


def parse_frontmatter(text: str) -> tuple[dict, str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text
    meta = yaml.safe_load(match.group(1)) or {}
    body = text[match.end():]
    return meta, body


def extract_checkable_text(section_type: str, meta: dict, body: str) -> tuple[str, set[str]]:
    """Return (text_to_check, exempt_proper_nouns) for a section."""
    exempt = set()
    for key in ("speakers", "proper_nouns"):
        for name in meta.get(key) or []:
            exempt.add(str(name))

    if section_type == "input_dialogue":
        lines = DIALOGUE_LINE_RE.findall(body)
        return "\n".join(lines), exempt

    # input_reading and anything else: use the whole body, stripping
    # markdown headings/list markers so they don't pollute tokenization.
    cleaned = re.sub(r"^#{1,6}\s*.*$", "", body, flags=re.MULTILINE)
    return cleaned, exempt


def tokenize(text: str, exempt_proper_nouns: set[str]) -> list[str]:
    tokens = []
    for raw in WORD_RE.findall(text):
        word = raw.strip("'")
        if not word:
            continue
        if word in exempt_proper_nouns:
            continue
        # A capitalized token not in the exempt list is almost certainly a
        # name/proper noun we forgot to register -- still counted as
        # "unknown" below so it surfaces for the author to fix, rather than
        # silently skipped.
        tokens.append(word.lower())
    return tokens


def mask_known_phrases(text: str, known_phrases: set[str]) -> str:
    """Remove multi-word known phrases from text before word tokenization."""
    # Longest phrases first so overlapping substrings don't leave partial
    # fragments behind.
    for phrase in sorted(known_phrases, key=len, reverse=True):
        if " " not in phrase:
            continue
        pattern = re.compile(re.escape(phrase), re.IGNORECASE)
        text = pattern.sub(" ", text)
    return text


def check_unit(
    unit_dir: Path,
    cumulative_known: set[str],
    threshold: float,
) -> tuple[UnitCheckResult, set[str]]:
    unit_yaml = yaml.safe_load((unit_dir / "unit.yaml").read_text(encoding="utf-8"))
    unit_num = unit_yaml["unit"]
    result = UnitCheckResult(unit=unit_num, title=unit_yaml.get("title", ""))

    unit_targets = {w.lower() for w in unit_yaml.get("vocabulary_targets", [])}
    known_after_this_unit = cumulative_known | unit_targets

    known_words = {w for w in known_after_this_unit if " " not in w}
    known_phrases = {w for w in known_after_this_unit if " " in w}

    sections_dir = unit_dir / "sections"
    for section_meta in unit_yaml.get("sections", []):
        section_type = section_meta.get("type")
        if section_type not in GATED_SECTION_TYPES:
            continue
        section_id = section_meta["id"]
        section_path = sections_dir / f"{section_id}.md"
        if not section_path.exists():
            result.sections.append(SectionCheckResult(unit_num, section_id, 0, [f"MISSING FILE: {section_path}"]))
            continue

        raw = section_path.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(raw)
        text, exempt = extract_checkable_text(section_type, meta, body)
        text = mask_known_phrases(text, known_phrases)
        tokens = tokenize(text, exempt)

        unknown = [t for t in tokens if t not in known_words]
        result.sections.append(SectionCheckResult(unit_num, section_id, len(tokens), unknown))

    return result, known_after_this_unit


def run(content_dir: Path, threshold: float) -> tuple[list[UnitCheckResult], bool]:
    baseline = load_baseline_vocabulary(content_dir)
    vocab_csv = load_vocabulary_csv(content_dir)

    cumulative_known = set(baseline)
    results: list[UnitCheckResult] = []
    all_passed = True

    for unit_dir in discover_units(content_dir):
        unit_yaml = yaml.safe_load((unit_dir / "unit.yaml").read_text(encoding="utf-8"))
        unit_num = unit_yaml["unit"]
        declared_targets = {w.lower() for w in unit_yaml.get("vocabulary_targets", [])}
        csv_words = {w.lower() for w in vocab_csv.get(unit_num, set())}

        result, cumulative_known = check_unit(unit_dir, cumulative_known, threshold)

        if csv_words and declared_targets != csv_words:
            missing_from_csv = declared_targets - csv_words
            missing_from_yaml = csv_words - declared_targets
            if missing_from_csv:
                result.vocab_csv_mismatches.append(
                    f"in unit.yaml but not in vocabulary.csv: {sorted(missing_from_csv)}"
                )
            if missing_from_yaml:
                result.vocab_csv_mismatches.append(
                    f"in vocabulary.csv but not in unit.yaml: {sorted(missing_from_yaml)}"
                )

        results.append(result)
        if not result.passed(threshold):
            all_passed = False

    return results, all_passed


def find_duplicate_can_do_ids(content_dir: Path) -> dict[str, list[int]]:
    """Return {can_do_id: [unit_numbers...]} for any id used by 2+ units.

    can_do_id is used as a DB key (can_do_responses.can_do_id, CLAUDE.md
    section 6.3), so it must be globally unique across the whole book, not
    just within a unit. Units are authored somewhat independently (see
    scripts.md / commit history), so collisions can slip in.
    """
    seen: dict[str, list[int]] = {}
    for unit_dir in discover_units(content_dir):
        unit_yaml = yaml.safe_load((unit_dir / "unit.yaml").read_text(encoding="utf-8"))
        for cd in unit_yaml.get("can_do", []):
            seen.setdefault(cd["id"], []).append(unit_yaml["unit"])
    return {cid: units for cid, units in seen.items() if len(units) > 1}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--content-dir", type=Path, default=DEFAULT_CONTENT_DIR)
    parser.add_argument("--threshold", type=float, default=0.98)
    args = parser.parse_args(argv)

    results, all_passed = run(args.content_dir, args.threshold)
    duplicate_can_do_ids = find_duplicate_can_do_ids(args.content_dir)

    for unit_result in results:
        status = "PASS" if unit_result.passed(args.threshold) else "FAIL"
        print(f"[{status}] Unit {unit_result.unit}: {unit_result.title}")
        for mismatch in unit_result.vocab_csv_mismatches:
            print(f"    vocabulary.csv mismatch: {mismatch}")
        for section in unit_result.sections:
            section_status = "ok" if section.passed(args.threshold) else "GATE FAIL"
            print(
                f"    {section.section_id}: {section.coverage:.1%} coverage "
                f"({section.total_tokens} tokens) [{section_status}]"
            )
            if section.unknown_tokens:
                unique_unknown = sorted(set(section.unknown_tokens))
                print(f"        unknown words: {unique_unknown}")

    if duplicate_can_do_ids:
        print("\nDuplicate can_do IDs (must be globally unique across the book):")
        for can_do_id, units in sorted(duplicate_can_do_ids.items()):
            print(f"    {can_do_id}: used by units {units}")

    final_ok = all_passed and not duplicate_can_do_ids
    if final_ok:
        print(f"\nAll units pass the {args.threshold:.0%} coverage gate.")
        return 0

    reasons = []
    if not all_passed:
        reasons.append(f"one or more units did not reach {args.threshold:.0%} coverage")
    if duplicate_can_do_ids:
        reasons.append("duplicate can_do IDs found")
    print(f"\nBUILD FAILED: {'; '.join(reasons)}.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
