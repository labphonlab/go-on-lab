from pathlib import Path

import build_paperback_cover
import yaml

REAL_CONTENT_DIR = Path(__file__).resolve().parent.parent.parent / "content"


def test_compute_spine_width_in_scales_with_pages():
    assert build_paperback_cover.compute_spine_width_in(100) == 0.25
    assert build_paperback_cover.compute_spine_width_in(199) == 0.4975
    assert build_paperback_cover.compute_spine_width_in(0) == 0.0


def test_render_wrap_cover_typst_dimensions_match_trim_plus_bleed():
    book_meta = yaml.safe_load((REAL_CONTENT_DIR / "book_meta.yaml").read_text(encoding="utf-8"))
    trim = book_meta["trim_size"]

    source, dims = build_paperback_cover.render_wrap_cover_typst(book_meta, page_count=199)

    expected_spine = build_paperback_cover.compute_spine_width_in(199)
    assert dims["spine_w"] == expected_spine
    expected_canvas_w = 2 * trim["width_in"] + expected_spine + 2 * build_paperback_cover.BLEED_IN
    expected_canvas_h = trim["height_in"] + 2 * build_paperback_cover.BLEED_IN
    assert dims["canvas_w"] == expected_canvas_w
    assert dims["canvas_h"] == expected_canvas_h

    assert f"width: {expected_canvas_w}in" in source
    assert book_meta["title"] in source
    assert "KDP" in source  # barcode placeholder note present


def test_render_wrap_cover_typst_panels_do_not_overlap():
    book_meta = yaml.safe_load((REAL_CONTENT_DIR / "book_meta.yaml").read_text(encoding="utf-8"))
    _, dims = build_paperback_cover.render_wrap_cover_typst(book_meta, page_count=199)

    # back panel ends where spine begins, spine ends where front begins
    trim_w = book_meta["trim_size"]["width_in"]
    assert dims["spine_x"] >= dims["back_x"]
    assert dims["front_x"] > dims["spine_x"]
    assert dims["front_x"] + trim_w <= dims["canvas_w"] + 1e-9
