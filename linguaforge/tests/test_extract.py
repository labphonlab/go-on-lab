from pathlib import Path

import pytest

from analysis.extract import extract_text


def test_extract_txt_passthrough(tmp_path: Path):
    p = tmp_path / "a.txt"
    p.write_text("hello world", encoding="utf-8")
    assert extract_text(p) == "hello world"


def test_extract_html_keeps_headings_and_list_items(tmp_path: Path):
    p = tmp_path / "a.html"
    p.write_text(
        "<html><body><h1>Cafe Talk</h1><p>Would you like coffee?</p>"
        "<ul><li>coffee</li><li>sugar</li></ul></body></html>",
        encoding="utf-8",
    )
    text = extract_text(p)
    assert "# Cafe Talk" in text
    assert "Would you like coffee?" in text
    assert "- coffee" in text
    assert "- sugar" in text


def test_extract_html_strips_scripts_and_styles(tmp_path: Path):
    p = tmp_path / "a.html"
    p.write_text(
        "<html><head><style>body{color:red}</style></head>"
        "<body><script>alert(1)</script><p>Visible text</p></body></html>",
        encoding="utf-8",
    )
    text = extract_text(p)
    assert "color:red" not in text
    assert "alert(1)" not in text
    assert "Visible text" in text


def test_extract_rtf(tmp_path: Path):
    p = tmp_path / "a.rtf"
    p.write_text(r"{\rtf1\ansi Cafe Talk\par Would you like coffee?\par}", encoding="utf-8")
    text = extract_text(p)
    assert "Cafe Talk" in text
    assert "Would you like coffee?" in text


def test_extract_docx(tmp_path: Path):
    docx = pytest.importorskip("docx")
    p = tmp_path / "a.docx"
    doc = docx.Document()
    doc.add_heading("Cafe Talk", level=1)
    doc.add_paragraph("Would you like coffee?")
    doc.add_paragraph("coffee", style="List Bullet")
    doc.save(str(p))

    text = extract_text(p)
    assert "# Cafe Talk" in text
    assert "Would you like coffee?" in text
    assert "- coffee" in text


def test_extract_pptx(tmp_path: Path):
    pptx_mod = pytest.importorskip("pptx")
    p = tmp_path / "a.pptx"
    prs = pptx_mod.Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = "Vocabulary"
    slide.placeholders[1].text_frame.text = "coffee"
    prs.save(str(p))

    text = extract_text(p)
    assert "# Vocabulary" in text
    assert "- coffee" in text


def test_extract_pdf(tmp_path: Path):
    pytest.importorskip("pypdf")
    reportlab_canvas = pytest.importorskip("reportlab.pdfgen.canvas")
    p = tmp_path / "a.pdf"
    c = reportlab_canvas.Canvas(str(p))
    c.drawString(100, 750, "Cafe Talk")
    c.drawString(100, 730, "Would you like coffee?")
    c.save()

    text = extract_text(p)
    assert "Cafe Talk" in text
    assert "Would you like coffee?" in text


def test_extract_unsupported_extension_raises(tmp_path: Path):
    p = tmp_path / "a.xyz"
    p.write_text("data", encoding="utf-8")
    with pytest.raises(ValueError):
        extract_text(p)
