import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import build_epub

REAL_CONTENT_DIR = Path(__file__).resolve().parent.parent.parent / "content"


def test_markdown_body_to_xhtml_handles_headings_lists_tables_bold():
    body = "## Heading\n\nSome **bold** text.\n\n- item one\n- item two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n"
    html = build_epub.markdown_body_to_xhtml(body)
    assert "<h2>Heading</h2>" in html
    assert "<strong>bold</strong>" in html
    assert "<li>item one</li>" in html
    assert "<li>item two</li>" in html
    assert html.count("<ul>") == 1 and html.count("</ul>") == 1
    assert "<table>" in html and "<td>1</td>" in html


def test_markdown_body_to_xhtml_escapes_html_special_chars():
    html = build_epub.markdown_body_to_xhtml("Use < and > and & carefully.")
    assert "&lt;" in html and "&gt;" in html and "&amp;" in html
    assert "<p>Use" in html


def test_build_epub_produces_valid_zip_with_mimetype_first_and_stored(tmp_path):
    epub_path = build_epub.build_epub(REAL_CONTENT_DIR, tmp_path / "epub")

    assert epub_path.exists()
    with zipfile.ZipFile(epub_path) as zf:
        names = zf.namelist()
        assert names[0] == "mimetype"
        assert zf.getinfo("mimetype").compress_type == zipfile.ZIP_STORED
        assert zf.read("mimetype") == b"application/epub+zip"

        for name in names:
            if name.endswith((".xhtml", ".opf", ".xml")):
                ET.fromstring(zf.read(name))  # raises on malformed XML

        assert "OEBPS/text/unit01.xhtml" in names
        assert "OEBPS/text/90-vocab-index.xhtml" in names
        assert "OEBPS/text/91-can-do-checklist.xhtml" in names
        assert "OEBPS/nav.xhtml" in names
        assert "OEBPS/content.opf" in names


def test_build_epub_uuid_is_deterministic_across_builds(tmp_path):
    p1 = build_epub.build_epub(REAL_CONTENT_DIR, tmp_path / "a")
    p2 = build_epub.build_epub(REAL_CONTENT_DIR, tmp_path / "b")
    with zipfile.ZipFile(p1) as z1, zipfile.ZipFile(p2) as z2:
        assert z1.read("OEBPS/content.opf") == z2.read("OEBPS/content.opf")


def test_unit_chapter_replaces_qr_image_with_plain_link():
    app_config = build_epub.build_pdf.load_app_config(REAL_CONTENT_DIR)
    xhtml, unit_yaml = build_epub.render_unit_chapter(REAL_CONTENT_DIR, 1, app_config)
    assert unit_yaml["unit"] == 1
    assert "goon.jp/u1s1" in xhtml
    assert "<img" not in xhtml
    # no duplicate heading: section title from frontmatter appears once,
    # not immediately followed by the body's own former internal heading
    assert xhtml.count("ウォームアップ：週末、何してる？") == 1
