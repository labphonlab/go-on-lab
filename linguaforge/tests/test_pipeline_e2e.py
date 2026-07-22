import json
from pathlib import Path

from pipeline import run_pipeline

SAMPLES_INPUT = Path(__file__).resolve().parent.parent / "samples" / "input"


def test_pipeline_runs_end_to_end_on_samples_in_mock_mode(tmp_path: Path):
    output_dir = tmp_path / "output"

    course = run_pipeline(SAMPLES_INPUT, output_dir, lang=None, mock=True, model=None)

    # 01_intro.md (dialogue), 02_vocab.md (vocabulary_list), 03_snacks.html (vocabulary_list)
    assert [s.id for s in course.sections] == ["01", "02", "03"]
    assert course.sections[0].content_type == "dialogue"
    assert course.sections[1].content_type == "vocabulary_list"
    # proves the .html input actually got parsed, not silently skipped
    assert course.sections[2].content_type == "vocabulary_list"
    assert any(it.text == "cookie" for it in course.sections[2].items)

    assert (output_dir / "report.md").exists()
    assert (output_dir / "data" / "course.json").exists()

    app_dir = output_dir / "app"
    assert (app_dir / "data" / "course.json").exists()
    assert (app_dir / "public" / "data" / "course.json").exists()
    assert (app_dir / "package.json").exists()

    # the file the Next.js template statically imports must be the real
    # course, not the empty templates/base-app/data/course.json placeholder
    bundled = json.loads((app_dir / "data" / "course.json").read_text(encoding="utf-8"))
    assert len(bundled["sections"]) == 3

    # audio referenced by items must actually be copied into the app
    for wav in ("01_intro.wav", "02_vocab.wav", "03_snacks.wav"):
        assert (app_dir / "public" / "audio" / wav).exists()


def test_pipeline_rejects_non_english_lang_in_phase_1(tmp_path: Path):
    import pytest

    with pytest.raises(NotImplementedError):
        run_pipeline(SAMPLES_INPUT, tmp_path / "output", lang="ko", mock=True, model=None)
