from pathlib import Path

import pytest
import export_app

REAL_CONTENT_DIR = Path(__file__).resolve().parent.parent.parent / "content"
REAL_UNIT01_DIR = REAL_CONTENT_DIR / "units" / "unit01"

REQUIRED_ROLEPLAY_KEYS = {
    "type",
    "scenario",
    "ai_role",
    "learner_goal",
    "known_vocab_cap",
    "recast",
    "clarification_requests",
    "eval_rubric",
}


def test_export_real_unit01_matches_schema():
    export = export_app.export_unit(REAL_CONTENT_DIR, REAL_UNIT01_DIR)

    assert export["unit"] == 1
    assert isinstance(export["components"], list) and export["components"]

    types = [c["type"] for c in export["components"]]
    assert types.count("flashcard_sm2") == 1
    assert "roleplay_ai" in types
    assert "can_do_survey" in types

    flashcards = next(c for c in export["components"] if c["type"] == "flashcard_sm2")
    assert len(flashcards["items"]) == 45
    for item in flashcards["items"]:
        assert item["id"] and item["en"] and item["ja"]

    roleplay = next(c for c in export["components"] if c["type"] == "roleplay_ai")
    assert REQUIRED_ROLEPLAY_KEYS.issubset(roleplay.keys())
    assert roleplay["scenario"] and roleplay["ai_role"] and roleplay["learner_goal"]
    assert roleplay["recast"] is True
    assert roleplay["clarification_requests"] is True

    can_do = next(c for c in export["components"] if c["type"] == "can_do_survey")
    assert len(can_do["items"]) == 2
    assert all(item["id"] and item["ja"] for item in can_do["items"])

    dictation = next(c for c in export["components"] if c["type"] == "dictation")
    assert len(dictation["items"]) == 16
    assert dictation["items"][0]["speaker"] == "Ben"


def test_shadowing_deduplicated_when_fluency_reuses_input_audio():
    export = export_app.export_unit(REAL_CONTENT_DIR, REAL_UNIT01_DIR)
    shadowing_blocks = [c for c in export["components"] if c["type"] == "shadowing"]
    assert len(shadowing_blocks) == 1
    assert shadowing_blocks[0]["audio"] == "audio/01-input-dialogue.mp3"


def test_roleplay_ai_missing_block_raises(tmp_path):
    content_dir = tmp_path / "content"
    unit_dir = content_dir / "units" / "unit01"
    sections_dir = unit_dir / "sections"
    sections_dir.mkdir(parents=True)

    (unit_dir / "unit.yaml").write_text(
        """
unit: 1
title: "Test Unit"
sections:
  - id: "01-main-task"
    type: main_task
    app_components: [roleplay_ai]
""",
        encoding="utf-8",
    )
    (sections_dir / "01-main-task.md").write_text(
        "---\nid: 01-main-task\n---\n\nNo roleplay block here.\n", encoding="utf-8"
    )

    with pytest.raises(export_app.ExportError):
        export_app.export_unit(content_dir, unit_dir)


def test_unknown_app_component_raises(tmp_path):
    content_dir = tmp_path / "content"
    unit_dir = content_dir / "units" / "unit01"
    sections_dir = unit_dir / "sections"
    sections_dir.mkdir(parents=True)

    (unit_dir / "unit.yaml").write_text(
        """
unit: 1
title: "Test Unit"
sections:
  - id: "01-warmup"
    type: warmup
    app_components: [not_a_real_component]
""",
        encoding="utf-8",
    )
    (sections_dir / "01-warmup.md").write_text(
        "---\nid: 01-warmup\n---\n\nSome text.\n", encoding="utf-8"
    )

    with pytest.raises(export_app.ExportError):
        export_app.export_unit(content_dir, unit_dir)
