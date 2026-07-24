import json
from pathlib import Path

import pytest
import build_pdf

REAL_CONTENT_DIR = Path(__file__).resolve().parent.parent.parent / "content"

APP_CONFIG = {"deep_link_base": "https://learn.goonresearch.jp", "short_domain": "goon.jp"}


def test_compute_qr_sections_only_for_app_components():
    unit_yaml = {
        "unit": 1,
        "sections": [
            {"id": "01-warmup", "app_components": []},
            {"id": "01-input-dialogue", "app_components": ["shadowing", "dictation"]},
            {"id": "01-noticing"},  # no app_components key at all
            {"id": "01-main-task", "app_components": ["roleplay_ai"]},
        ],
    }
    qr_sections = build_pdf.compute_qr_sections(unit_yaml, APP_CONFIG)
    assert [qr.section_id for qr in qr_sections] == ["01-input-dialogue", "01-main-task"]
    assert [qr.n for qr in qr_sections] == [1, 2]
    assert qr_sections[0].short_code == "u1s1"
    assert qr_sections[0].deep_link == "https://learn.goonresearch.jp/u/1/01-input-dialogue"
    assert qr_sections[0].short_url == "goon.jp/u1s1"
    assert qr_sections[1].short_code == "u1s2"


def test_compute_qr_sections_real_unit01_matches_expected_codes():
    unit_yaml = build_pdf.yaml.safe_load(
        (REAL_CONTENT_DIR / "units" / "unit01" / "unit.yaml").read_text(encoding="utf-8")
    )
    app_config = build_pdf.load_app_config(REAL_CONTENT_DIR)
    qr_sections = build_pdf.compute_qr_sections(unit_yaml, app_config)
    codes = {qr.section_id: qr.short_code for qr in qr_sections}
    assert codes == {
        "01-input-dialogue": "u1s1",
        "01-form-production": "u1s2",
        "01-main-task": "u1s3",
        "01-fluency": "u1s4",
        "01-reflection": "u1s5",
    }


def test_generate_qr_svg_writes_valid_svg(tmp_path):
    out_path = tmp_path / "qr" / "test.svg"
    build_pdf.generate_qr_svg("https://learn.goonresearch.jp/u/1/01-input-dialogue", out_path)
    assert out_path.exists()
    svg = out_path.read_text(encoding="utf-8")
    assert svg.startswith("<?xml")
    assert "<svg" in svg


def test_write_qr_manifest_merges_across_units(tmp_path):
    manifest_path = tmp_path / "qr-map.json"
    unit1_entries = [
        build_pdf.QRSection("01-input-dialogue", 1, "https://x/u/1/a", "u1s1", "goon.jp/u1s1"),
    ]
    unit2_entries = [
        build_pdf.QRSection("02-input-dialogue", 1, "https://x/u/2/a", "u2s1", "goon.jp/u2s1"),
    ]
    build_pdf.write_qr_manifest(manifest_path, unit1_entries)
    build_pdf.write_qr_manifest(manifest_path, unit2_entries)

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest == {"u1s1": "https://x/u/1/a", "u2s1": "https://x/u/2/a"}


def test_write_qr_manifest_rejects_short_code_collision(tmp_path):
    manifest_path = tmp_path / "qr-map.json"
    first = [build_pdf.QRSection("a", 1, "https://x/a", "u1s1", "goon.jp/u1s1")]
    conflicting = [build_pdf.QRSection("b", 1, "https://x/b", "u1s1", "goon.jp/u1s1")]

    build_pdf.write_qr_manifest(manifest_path, first)
    with pytest.raises(ValueError):
        build_pdf.write_qr_manifest(manifest_path, conflicting)


def test_render_unit_typst_embeds_qr_grid_for_real_unit01(tmp_path):
    app_config = build_pdf.load_app_config(REAL_CONTENT_DIR)
    qr_dir = tmp_path / "qr" / "unit01"
    source, qr_sections = build_pdf.render_unit_typst(
        REAL_CONTENT_DIR, 1, app_config, qr_dir, "qr/unit01"
    )
    assert len(qr_sections) == 5
    for qr in qr_sections:
        assert (qr_dir / f"{qr.section_id}.svg").exists()
        assert f'image("qr/unit01/{qr.section_id}.svg"' in source
        assert qr.short_url in source
