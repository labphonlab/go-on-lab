#!/usr/bin/env python3
"""Assemble content/{book_meta.yaml,front_matter/,units/} into a Kindle-
ready EPUB3 file (build/epub/book.epub).

STATUS: fully implemented and runnable without any external tools --
EPUB is just a zip of XHTML/CSS/XML files, built here with Python's
stdlib zipfile. KDP accepts EPUB directly for the Kindle edition (it
converts EPUB -> its internal formats on ingestion), so this output can
be uploaded as-is; you do not need Kindle Create or a separate converter.

Differences from the print build (scripts/build_pdf.py):
  - Section QR codes become plain clickable links (`goon.jp/u{unit}s{n}`),
    since a QR code is only useful when you can't already tap the link.
  - No physical page numbers / trim size -- EPUB is reflowable, so layout
    is left to the reading device. A single stylesheet (styles/style.css)
    controls typography.
  - No page-restart-at-1 numbering concern -- EPUB has no "pages" until
    the reading device renders them.

Usage:
    python3 scripts/build_epub.py                 # build/epub/book.epub
    python3 scripts/build_epub.py --out-dir DIR
"""
from __future__ import annotations

import argparse
import html
import re
import sys
import uuid
import zipfile
from pathlib import Path

import build_pdf  # reuses parse_frontmatter / load_book_meta / load_app_config / discover_unit_dirs
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTENT_DIR = REPO_ROOT / "content"
DEFAULT_OUT_DIR = REPO_ROOT / "build" / "epub"

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
TABLE_ROW_RE = re.compile(r"^\|(.+)\|$")


def escape_html(text: str) -> str:
    return html.escape(text, quote=False)


def inline_md_to_html(text: str) -> str:
    text = escape_html(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    return text


def convert_table_html(lines: list[str]) -> str:
    rows = [TABLE_ROW_RE.match(line).group(1) for line in lines]  # type: ignore[union-attr]
    cells = [[c.strip() for c in row.split("|")] for row in rows]
    cells = [row for row in cells if not all(re.fullmatch(r":?-+:?", c) for c in row)]
    if not cells:
        return ""
    out = ["<table>", "  <tr>"]
    out += [f"    <th>{inline_md_to_html(c)}</th>" for c in cells[0]]
    out.append("  </tr>")
    for row in cells[1:]:
        out.append("  <tr>")
        out += [f"    <td>{inline_md_to_html(c)}</td>" for c in row]
        out.append("  </tr>")
    out.append("</table>")
    return "\n".join(out)


def markdown_body_to_xhtml(body: str) -> str:
    lines = body.splitlines()
    out: list[str] = []
    i = 0
    list_open = False

    def close_list():
        nonlocal list_open
        if list_open:
            out.append("</ul>")
            list_open = False

    while i < len(lines):
        line = lines[i]

        if not line.strip():
            close_list()
            i += 1
            continue

        heading = HEADING_RE.match(line)
        if heading:
            close_list()
            level = min(len(heading.group(1)), 6)
            out.append(f"<h{level}>{inline_md_to_html(heading.group(2))}</h{level}>")
            i += 1
            continue

        if line.strip() == "---":
            close_list()
            out.append("<hr/>")
            i += 1
            continue

        if TABLE_ROW_RE.match(line):
            close_list()
            table_lines = []
            while i < len(lines) and TABLE_ROW_RE.match(lines[i]):
                table_lines.append(lines[i])
                i += 1
            out.append(convert_table_html(table_lines))
            continue

        if line.strip().startswith("> "):
            close_list()
            out.append(f"<blockquote><p>{inline_md_to_html(line.strip()[2:])}</p></blockquote>")
            i += 1
            continue

        if line.strip().startswith(("- ", "* ")):
            if not list_open:
                out.append("<ul>")
                list_open = True
            out.append(f"<li>{inline_md_to_html(line.strip()[2:])}</li>")
            i += 1
            continue

        close_list()
        out.append(f"<p>{inline_md_to_html(line)}</p>")
        i += 1

    close_list()
    return "\n".join(out)


XHTML_WRAPPER = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head>
  <meta charset="utf-8"/>
  <title>{title}</title>
  <link rel="stylesheet" type="text/css" href="../styles/style.css"/>
</head>
<body>
{body}
</body>
</html>
"""


def wrap_xhtml(title: str, body_html: str) -> str:
    return XHTML_WRAPPER.format(title=escape_html(title), body=body_html)


def render_title_chapter(book_meta: dict) -> str:
    body = (
        '<div class="titlepage">\n'
        f'  <h1>{escape_html(book_meta["title"])}</h1>\n'
        f'  <p class="subtitle">{escape_html(book_meta["subtitle"])}</p>\n'
        f'  <p class="author">{escape_html(book_meta["author"])}</p>\n'
        "</div>"
    )
    return wrap_xhtml(book_meta["title"], body)


def render_copyright_chapter(book_meta: dict) -> str:
    lines = [
        "<div class=\"copyright\">",
        f'  <p>{escape_html(book_meta["title"])}：{escape_html(book_meta["subtitle"])}</p>',
        f'  <p>© {book_meta["copyright_year"]} {escape_html(book_meta["publisher"])}. '
        "All rights reserved.</p>",
        "  <p>本書の全部または一部を、発行者の書面による許諾なく複製・転載することを禁じます。</p>",
        f'  <p>発行： {escape_html(book_meta["publisher"])}　'
        f'<a href="{escape_html(book_meta["publisher_url"])}">{escape_html(book_meta["publisher_url"])}</a></p>',
        f'  <p>学習アプリ： <a href="{escape_html(book_meta["app_url"])}">{escape_html(book_meta["app_url"])}</a></p>',
        f'  <p>お問い合わせ： {escape_html(book_meta["contact_email"])}</p>',
        "</div>",
    ]
    return wrap_xhtml("奥付", "\n".join(lines))


def render_how_to_use_chapter(content_dir: Path) -> str:
    meta, body = build_pdf.parse_frontmatter(content_dir / "front_matter" / "how-to-use.md")
    title = meta.get("title_ja", "how-to-use")
    body_html = f"<h1>{escape_html(title)}</h1>\n" + markdown_body_to_xhtml(body)
    return wrap_xhtml(title, body_html)


def render_unit_chapter(content_dir: Path, unit_num: int, app_config: dict) -> tuple[str, dict]:
    unit_dir = content_dir / "units" / f"unit{unit_num:02d}"
    unit_yaml = yaml.safe_load((unit_dir / "unit.yaml").read_text(encoding="utf-8"))
    qr_sections = build_pdf.compute_qr_sections(unit_yaml, app_config)
    qr_by_section = {qr.section_id: qr for qr in qr_sections}

    parts = [
        f'<h1>Unit {unit_yaml["unit"]}: {escape_html(unit_yaml["title"])}</h1>',
        f'<p class="cefr-badge">CEFR-J {escape_html(unit_yaml.get("cefr_j", ""))}</p>',
        "<h2>Can-do</h2>",
        "<ul>",
    ]
    for cd in unit_yaml.get("can_do", []):
        parts.append(f'  <li><strong>{escape_html(cd["id"])}</strong>: {escape_html(cd["ja"])}</li>')
    parts.append("</ul>")

    for section in unit_yaml.get("sections", []):
        section_path = unit_dir / "sections" / f"{section['id']}.md"
        if not section_path.exists():
            continue
        meta, body = build_pdf.parse_frontmatter(section_path)
        title = meta.get("title_ja", section["id"])
        parts.append(f"<h2>{escape_html(title)}</h2>")
        parts.append(markdown_body_to_xhtml(body))

        qr = qr_by_section.get(section["id"])
        if qr is not None:
            parts.append(
                '<p class="app-link">'
                f'<a href="{escape_html(qr.deep_link)}">アプリで続ける — {escape_html(qr.short_url)}</a></p>'
            )

    return wrap_xhtml(f"Unit {unit_num}: {unit_yaml['title']}", "\n".join(parts)), unit_yaml


def render_vocabulary_index_chapter(content_dir: Path) -> str:
    import csv

    rows = []
    with (content_dir / "vocabulary.csv").open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            rows.append(row)
    rows.sort(key=lambda r: r["word"].lower())

    parts = ["<h1>語彙索引</h1>", "<table>", "  <tr><th>語</th><th>発音記号</th><th>意味</th><th>初出Unit</th></tr>"]
    for row in rows:
        parts.append(
            "  <tr>"
            f"<td>{escape_html(row['word'])}</td>"
            f"<td>{escape_html(row['ipa'])}</td>"
            f"<td>{escape_html(row['ja'])}</td>"
            f"<td>{escape_html(row['unit'])}</td>"
            "</tr>"
        )
    parts.append("</table>")
    return wrap_xhtml("語彙索引", "\n".join(parts))


def render_can_do_checklist_chapter(unit_yamls: list[dict]) -> str:
    parts = ["<h1>Can-do チェックリスト総覧</h1>"]
    for unit_yaml in unit_yamls:
        can_do = unit_yaml.get("can_do") or []
        if not can_do:
            continue
        parts.append(f'<h2>Unit {unit_yaml["unit"]}: {escape_html(unit_yaml["title"])}</h2>')
        parts.append("<ul>")
        for cd in can_do:
            parts.append(f"  <li>☐ {escape_html(cd['ja'])}</li>")
        parts.append("</ul>")
    return wrap_xhtml("Can-do チェックリスト総覧", "\n".join(parts))


STYLE_CSS = """
body { font-family: "Hiragino Mincho ProN", "Yu Mincho", serif; line-height: 1.8; margin: 1em; }
h1 { font-size: 1.6em; margin-top: 1.2em; }
h2 { font-size: 1.3em; margin-top: 1.4em; border-bottom: 1px solid #999; padding-bottom: 0.2em; }
h3 { font-size: 1.1em; margin-top: 1em; }
p { margin: 0.6em 0; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #999; padding: 0.4em 0.6em; text-align: left; font-size: 0.9em; }
blockquote { margin: 1em 1.5em; font-style: italic; color: #444; }
.titlepage { text-align: center; margin-top: 30%; }
.titlepage h1 { font-size: 2em; }
.subtitle { font-size: 1.1em; margin-top: 0.8em; }
.author { margin-top: 3em; }
.cefr-badge { color: #666; font-size: 0.85em; }
.app-link { background: #eef6f6; padding: 0.6em 0.8em; border-radius: 4px; font-size: 0.9em; }
"""

CONTAINER_XML = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""


def build_book_uuid(book_meta: dict) -> str:
    # Deterministic (not random) so re-running the build doesn't change the
    # book's identity each time. Swap for a real ISBN-derived URN once one
    # is purchased/assigned (see docs/kdp-metadata.md).
    seed = f"{book_meta['title']}|{book_meta['publisher_url']}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, seed))


def render_opf(book_meta: dict, chapters: list[tuple[str, str]]) -> str:
    """chapters: list of (id, xhtml_filename), in spine order."""
    book_id = build_book_uuid(book_meta)
    manifest_items = "\n".join(
        f'    <item id="{cid}" href="text/{fname}" media-type="application/xhtml+xml"/>'
        for cid, fname in chapters
    )
    spine_items = "\n".join(f'    <itemref idref="{cid}"/>' for cid, _ in chapters)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:{book_id}</dc:identifier>
    <dc:title>{escape_html(book_meta['title'])}</dc:title>
    <dc:creator>{escape_html(book_meta['author'])}</dc:creator>
    <dc:publisher>{escape_html(book_meta['publisher'])}</dc:publisher>
    <dc:language>ja</dc:language>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="styles/style.css" media-type="text/css"/>
{manifest_items}
  </manifest>
  <spine>
{spine_items}
  </spine>
</package>
"""


def render_nav(chapters_for_nav: list[tuple[str, str, str]]) -> str:
    """chapters_for_nav: list of (title, filename, nav_depth_class)."""
    items = "\n".join(
        f'      <li><a href="text/{fname}">{escape_html(title)}</a></li>' for title, fname, _ in chapters_for_nav
    )
    body = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja">
<head><meta charset="utf-8"/><title>目次</title><link rel="stylesheet" type="text/css" href="styles/style.css"/></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目次</h1>
    <ol>
{items}
    </ol>
  </nav>
</body>
</html>
"""
    return body


def build_epub(content_dir: Path, out_dir: Path) -> Path:
    book_meta = build_pdf.load_book_meta(content_dir)
    app_config = build_pdf.load_app_config(content_dir)
    unit_dirs = build_pdf.discover_unit_dirs(content_dir)

    text_dir = out_dir / "OEBPS" / "text"
    styles_dir = out_dir / "OEBPS" / "styles"
    text_dir.mkdir(parents=True, exist_ok=True)
    styles_dir.mkdir(parents=True, exist_ok=True)
    (styles_dir / "style.css").write_text(STYLE_CSS, encoding="utf-8")

    chapters: list[tuple[str, str]] = []  # (id, filename) in spine order
    nav_entries: list[tuple[str, str, str]] = []  # (title, filename, class)

    def add_chapter(cid: str, filename: str, title: str, xhtml: str, in_nav: bool = True):
        (text_dir / filename).write_text(xhtml, encoding="utf-8")
        chapters.append((cid, filename))
        if in_nav:
            nav_entries.append((title, filename, "top"))

    add_chapter("title", "00-title.xhtml", book_meta["title"], render_title_chapter(book_meta))
    add_chapter("copyright", "01-copyright.xhtml", "奥付", render_copyright_chapter(book_meta), in_nav=False)
    add_chapter(
        "how-to-use", "02-how-to-use.xhtml", "このテキストの使い方", render_how_to_use_chapter(content_dir)
    )

    unit_yamls = []
    for unit_dir in unit_dirs:
        unit_num = yaml.safe_load((unit_dir / "unit.yaml").read_text(encoding="utf-8"))["unit"]
        xhtml, unit_yaml = render_unit_chapter(content_dir, unit_num, app_config)
        unit_yamls.append(unit_yaml)
        add_chapter(
            f"unit{unit_num:02d}",
            f"unit{unit_num:02d}.xhtml",
            f"Unit {unit_num}: {unit_yaml['title']}",
            xhtml,
        )

    add_chapter(
        "vocab-index", "90-vocab-index.xhtml", "語彙索引", render_vocabulary_index_chapter(content_dir)
    )
    add_chapter(
        "can-do-checklist",
        "91-can-do-checklist.xhtml",
        "Can-do チェックリスト総覧",
        render_can_do_checklist_chapter(unit_yamls),
    )

    (out_dir / "OEBPS" / "content.opf").write_text(render_opf(book_meta, chapters), encoding="utf-8")
    (out_dir / "OEBPS" / "nav.xhtml").write_text(render_nav(nav_entries), encoding="utf-8")

    meta_inf = out_dir / "META-INF"
    meta_inf.mkdir(parents=True, exist_ok=True)
    (meta_inf / "container.xml").write_text(CONTAINER_XML, encoding="utf-8")
    (out_dir / "mimetype").write_text("application/epub+zip", encoding="utf-8")

    epub_path = out_dir / "book.epub"
    if epub_path.exists():
        epub_path.unlink()
    with zipfile.ZipFile(epub_path, "w") as zf:
        # mimetype MUST be first and stored (uncompressed) per the EPUB spec.
        zf.write(out_dir / "mimetype", "mimetype", compress_type=zipfile.ZIP_STORED)
        for path in sorted(out_dir.rglob("*")):
            if path.is_dir() or path.name == "mimetype" or path == epub_path:
                continue
            zf.write(path, path.relative_to(out_dir), compress_type=zipfile.ZIP_DEFLATED)

    return epub_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--content-dir", type=Path, default=DEFAULT_CONTENT_DIR)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args(argv)

    epub_path = build_epub(args.content_dir, args.out_dir)
    print(f"wrote {epub_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
