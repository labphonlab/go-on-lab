from pathlib import Path

import build_pdf

REAL_CONTENT_DIR = Path(__file__).resolve().parent.parent.parent / "content"


def test_load_book_meta_has_required_fields():
    meta = build_pdf.load_book_meta(REAL_CONTENT_DIR)
    for key in ("title", "subtitle", "author", "publisher", "trim_size"):
        assert key in meta
    for key in ("width_in", "height_in", "margin_inside_in", "margin_outside_in"):
        assert key in meta["trim_size"]


def test_render_full_book_typst_contains_all_structural_pieces(tmp_path):
    source, qr_sections = build_pdf.render_full_book_typst(REAL_CONTENT_DIR, tmp_path)

    assert '#set page(numbering: "i")' in source
    assert '#set page(numbering: "1")' in source
    # numbering: "i" must precede the title page content, and numbering:
    # "1" must precede Unit 1's heading -- else the restart lands on the
    # wrong page per Typst's forward-only #set semantics.
    assert source.index('#set page(numbering: "i")') < source.index("独習英語トレーニング")
    assert source.index('#set page(numbering: "1")') < source.index("= Unit 1")

    assert "#outline(title: " in source
    assert "= 語彙索引" in source
    assert "= Can-do チェックリスト総覧" in source
    assert "= Unit 1: Making Plans with Friends" in source
    assert len(qr_sections) == 5


def test_render_full_book_typst_vocab_index_sorted_and_complete():
    source, _ = build_pdf.render_full_book_typst(REAL_CONTENT_DIR, Path("/tmp/unused"))
    idx_start = source.index("= 語彙索引")
    idx_end = source.index("= Can-do チェックリスト総覧", idx_start)
    vocab_block = source[idx_start:idx_end]
    words_in_order = [
        line.split("],")[0].strip("  [")
        for line in vocab_block.splitlines()
        if line.strip().startswith("[") and "*語*" not in line
    ]
    assert words_in_order == sorted(words_in_order, key=str.lower)
    assert "weekend" in words_in_order
    assert len(words_in_order) == 45


def test_render_title_and_copyright_pages_include_meta_fields():
    meta = build_pdf.load_book_meta(REAL_CONTENT_DIR)
    title_page = build_pdf.render_title_page(meta)
    assert meta["title"] in title_page
    assert meta["subtitle"] in title_page

    copyright_page = build_pdf.render_copyright_page(meta)
    assert str(meta["copyright_year"]) in copyright_page
    assert meta["publisher"] in copyright_page
