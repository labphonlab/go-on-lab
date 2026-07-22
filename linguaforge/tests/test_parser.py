from pathlib import Path

import pytest

from analysis.parser import load_sections


def test_load_sections_pairs_text_and_audio_by_stem(tmp_path: Path):
    text_dir = tmp_path / "text"
    audio_dir = tmp_path / "audio"
    text_dir.mkdir()
    audio_dir.mkdir()

    (text_dir / "01_intro.md").write_text("# Intro\nhello", encoding="utf-8")
    (text_dir / "02_vocab.md").write_text("- coffee\n- sugar", encoding="utf-8")
    (audio_dir / "01_intro.wav").write_bytes(b"RIFF....WAVEfmt ")
    # 02_vocab has no matching audio file on purpose

    sections = load_sections(text_dir, audio_dir)

    assert [s.id for s in sections] == ["01", "02"]
    assert sections[0].title == "Intro"
    assert sections[0].audio_file == "01_intro.wav"
    assert sections[1].audio_file is None


def test_load_sections_raises_when_no_text_files(tmp_path: Path):
    text_dir = tmp_path / "text"
    audio_dir = tmp_path / "audio"
    text_dir.mkdir()
    audio_dir.mkdir()

    with pytest.raises(FileNotFoundError):
        load_sections(text_dir, audio_dir)


def test_section_id_falls_back_to_stem_without_leading_number(tmp_path: Path):
    text_dir = tmp_path / "text"
    audio_dir = tmp_path / "audio"
    text_dir.mkdir()
    audio_dir.mkdir()
    (text_dir / "appendix.md").write_text("notes", encoding="utf-8")

    sections = load_sections(text_dir, audio_dir)
    assert sections[0].id == "appendix"
