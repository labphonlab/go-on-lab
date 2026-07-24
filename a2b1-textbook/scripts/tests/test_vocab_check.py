from pathlib import Path

import pytest
import vocab_check

REAL_CONTENT_DIR = Path(__file__).resolve().parent.parent.parent / "content"


def test_load_baseline_vocabulary_skips_comments_and_blanks(tmp_path):
    (tmp_path / "baseline_vocabulary.txt").write_text(
        "# a comment\n\nhello\nWORLD\n", encoding="utf-8"
    )
    words = vocab_check.load_baseline_vocabulary(tmp_path)
    assert words == {"hello", "world"}


def test_tokenize_respects_exempt_proper_nouns():
    tokens = vocab_check.tokenize("Hi, Aya! I'll see you later.", exempt_proper_nouns={"Aya"})
    assert "aya" not in tokens
    assert "hi" in tokens
    assert "i'll" in tokens
    assert "later" in tokens


def test_mask_known_phrases_removes_multiword_phrase():
    text = "Let's meet up tomorrow, why don't we go to the park?"
    masked = vocab_check.mask_known_phrases(text, known_phrases={"meet up"})
    assert "meet up" not in masked.lower()


def test_mask_known_phrases_ignores_single_word_entries():
    text = "hello world"
    masked = vocab_check.mask_known_phrases(text, known_phrases={"hello"})
    assert masked == text


def test_real_unit01_passes_98_percent_gate():
    results, all_passed = vocab_check.run(REAL_CONTENT_DIR, threshold=0.98)
    assert results, "expected at least one unit to be checked"
    assert all_passed, [
        (r.unit, s.section_id, s.coverage, s.unknown_tokens)
        for r in results
        for s in r.sections
        if not s.passed(0.98)
    ]


def test_unit_with_unknown_words_fails_gate(tmp_path):
    content_dir = tmp_path / "content"
    (content_dir).mkdir()
    (content_dir / "baseline_vocabulary.txt").write_text("hello\nyou\n", encoding="utf-8")
    (content_dir / "vocabulary.csv").write_text(
        "word,ja,unit\nworld,世界,1\n", encoding="utf-8"
    )

    unit_dir = content_dir / "units" / "unit01"
    sections_dir = unit_dir / "sections"
    sections_dir.mkdir(parents=True)

    (unit_dir / "unit.yaml").write_text(
        """
unit: 1
title: "Test Unit"
vocabulary_targets: ["world"]
sections:
  - id: "01-input-dialogue"
    type: input_dialogue
""",
        encoding="utf-8",
    )
    (sections_dir / "01-input-dialogue.md").write_text(
        "---\nid: 01-input-dialogue\n---\n\n**A:** Hello, world! This is a spaceship.\n",
        encoding="utf-8",
    )

    results, all_passed = vocab_check.run(content_dir, threshold=0.98)
    assert not all_passed
    assert len(results) == 1
    section = results[0].sections[0]
    assert not section.passed(0.98)
    assert "spaceship" in section.unknown_tokens


def test_real_content_has_no_duplicate_can_do_ids():
    dupes = vocab_check.find_duplicate_can_do_ids(REAL_CONTENT_DIR)
    assert dupes == {}


def test_find_duplicate_can_do_ids_detects_collision(tmp_path):
    content_dir = tmp_path / "content"
    units_dir = content_dir / "units"
    for unit_num, can_do_id in ((1, "A2.2-SI-1"), (2, "A2.2-SI-1")):
        unit_dir = units_dir / f"unit{unit_num:02d}"
        unit_dir.mkdir(parents=True)
        (unit_dir / "unit.yaml").write_text(
            f"""
unit: {unit_num}
title: "Test Unit {unit_num}"
can_do:
  - id: "{can_do_id}"
    ja: "duplicate on purpose"
sections: []
""",
            encoding="utf-8",
        )

    dupes = vocab_check.find_duplicate_can_do_ids(content_dir)
    assert dupes == {"A2.2-SI-1": [1, 2]}


def test_vocabulary_csv_mismatch_fails_gate(tmp_path):
    content_dir = tmp_path / "content"
    content_dir.mkdir()
    (content_dir / "baseline_vocabulary.txt").write_text("hello\n", encoding="utf-8")
    (content_dir / "vocabulary.csv").write_text(
        "word,ja,unit\nworld,世界,1\n", encoding="utf-8"
    )

    unit_dir = content_dir / "units" / "unit01"
    sections_dir = unit_dir / "sections"
    sections_dir.mkdir(parents=True)
    (unit_dir / "unit.yaml").write_text(
        """
unit: 1
title: "Test Unit"
vocabulary_targets: ["galaxy"]
sections: []
""",
        encoding="utf-8",
    )

    results, all_passed = vocab_check.run(content_dir, threshold=0.98)
    assert not all_passed
    assert results[0].vocab_csv_mismatches
