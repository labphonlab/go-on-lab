#!/usr/bin/env python3
"""Render a unit's content/units/unitNN/{unit.yaml,sections/*.md} into a
Typst source file, then compile it to PDF.

STATUS: the Markdown -> Typst source generation, and the section QR code
generation (CLAUDE.md section 4), are fully implemented and run without
any external tools/network access -- QR SVGs are generated locally with
the `qrcode` package. The final PDF compile step shells out to the
`typst` CLI, which is NOT installed in this sandbox -- that step will
raise a clear error naming the missing binary and how to install it
(https://github.com/typst/typst#installation). Run with --typ-only to
generate build/pdf/unitNN.typ (+ QR SVGs + build/qr-map.json) without
attempting compilation.

The Markdown -> Typst conversion here is intentionally simple (headings,
bold, tables, horizontal rules, blank-line paragraphs) since unit content
is authored in a constrained subset of Markdown by design (see
content/units/unit01/sections/*.md). It is not a general Markdown
converter.

Every section whose unit.yaml entry has a non-empty `app_components` list
gets a QR code (deep link to `{deep_link_base}/u/{unit}/{section_id}`)
placed right after its content, plus a short URL caption
(`{short_domain}/u{unit}s{n}`, n = 1-based order among that unit's QR
sections). This is the only place QR codes are produced -- CLAUDE.md
section 4 explicitly forbids pasting them in by hand, since that would
let the printed URL and the actual content drift apart.

Usage:
    python3 scripts/build_pdf.py --unit 1                # .typ + QR + PDF
    python3 scripts/build_pdf.py --unit 1 --typ-only      # .typ + QR only
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import qrcode
import qrcode.image.svg
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTENT_DIR = REPO_ROOT / "content"
DEFAULT_BUILD_DIR = REPO_ROOT / "build" / "pdf"
DEFAULT_QR_MAP_PATH = REPO_ROOT / "build" / "qr-map.json"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
TABLE_ROW_RE = re.compile(r"^\|(.+)\|$")


@dataclass
class QRSection:
    section_id: str
    n: int
    deep_link: str
    short_code: str
    short_url: str


def load_app_config(content_dir: Path) -> dict:
    path = content_dir / "app_config.yaml"
    config = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    for key in ("deep_link_base", "short_domain"):
        if key not in config:
            raise KeyError(f"{path} is missing required key '{key}'")
    return config


def compute_qr_sections(unit_yaml: dict, app_config: dict) -> list[QRSection]:
    """QR entries for every section with app_components, in unit.yaml order.

    Short codes are "u{unit}s{n}" where n counts only QR-bearing sections
    (1-based), so they stay short and stable even if a unit gains
    paper-only sections later.
    """
    unit_num = unit_yaml["unit"]
    entries = []
    n = 0
    for section in unit_yaml.get("sections", []):
        if not section.get("app_components"):
            continue
        n += 1
        section_id = section["id"]
        deep_link = f"{app_config['deep_link_base']}/u/{unit_num}/{section_id}"
        short_code = f"u{unit_num}s{n}"
        short_url = f"{app_config['short_domain']}/{short_code}"
        entries.append(QRSection(section_id, n, deep_link, short_code, short_url))
    return entries


def generate_qr_svg(deep_link: str, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img = qrcode.make(deep_link, image_factory=qrcode.image.svg.SvgPathImage)
    img.save(str(out_path))


def write_qr_manifest(manifest_path: Path, entries: list[QRSection]) -> None:
    """Merge this run's short_code -> deep_link entries into the manifest.

    build/qr-map.json is the input the goon.jp short-domain redirect
    (Phase 2, CLAUDE.md section 10) will be built from, so it accumulates
    across units/builds rather than being overwritten each time.
    """
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    existing = {}
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))

    for entry in entries:
        if existing.get(entry.short_code, entry.deep_link) != entry.deep_link:
            raise ValueError(
                f"short_code collision: {entry.short_code} already maps to "
                f"{existing[entry.short_code]!r}, cannot also map to {entry.deep_link!r}"
            )
        existing[entry.short_code] = entry.deep_link

    manifest_path.write_text(
        json.dumps(existing, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def parse_frontmatter(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(raw)
    if not match:
        return {}, raw
    meta = yaml.safe_load(match.group(1)) or {}
    return meta, raw[match.end():]


def escape_typst(text: str) -> str:
    # Typst's markup mode treats these as syntax; escape when they appear
    # in ordinary prose carried over from Markdown.
    for ch in ("\\", "#", "@", "$", "_"):
        text = text.replace(ch, "\\" + ch)
    return text


def inline_md_to_typst(text: str) -> str:
    # **bold** -> *bold* (Typst uses single asterisks for strong emphasis)
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
    return text


def convert_table(lines: list[str]) -> str:
    rows = [TABLE_ROW_RE.match(line).group(1) for line in lines]  # type: ignore[union-attr]
    cells = [[c.strip() for c in row.split("|")] for row in rows]
    # Drop the Markdown separator row (---|---|---)
    cells = [row for row in cells if not all(re.fullmatch(r":?-+:?", c) for c in row)]
    if not cells:
        return ""
    ncols = len(cells[0])
    out = [f"#table(columns: {ncols},"]
    for row in cells:
        formatted = ", ".join(f"[{inline_md_to_typst(escape_typst(c))}]" for c in row)
        out.append(f"  {formatted},")
    out.append(")")
    return "\n".join(out)


def markdown_body_to_typst(body: str) -> str:
    lines = body.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]

        if not line.strip():
            out.append("")
            i += 1
            continue

        heading = HEADING_RE.match(line)
        if heading:
            level = len(heading.group(1))
            out.append("=" * level + " " + inline_md_to_typst(escape_typst(heading.group(2))))
            i += 1
            continue

        if line.strip() == "---":
            out.append("#line(length: 100%)")
            i += 1
            continue

        if TABLE_ROW_RE.match(line):
            table_lines = []
            while i < len(lines) and TABLE_ROW_RE.match(lines[i]):
                table_lines.append(lines[i])
                i += 1
            out.append(convert_table(table_lines))
            continue

        if line.strip().startswith("> "):
            out.append("#quote[" + inline_md_to_typst(escape_typst(line.strip()[2:])) + "]")
            i += 1
            continue

        if line.strip().startswith(("- ", "* ")):
            out.append("- " + inline_md_to_typst(escape_typst(line.strip()[2:])))
            i += 1
            continue

        out.append(inline_md_to_typst(escape_typst(line)))
        i += 1

    return "\n".join(out)


def render_unit_typst(
    content_dir: Path,
    unit_num: int,
    app_config: dict,
    qr_svg_dir: Path,
    qr_svg_dir_relative: str,
) -> tuple[str, list[QRSection]]:
    unit_dir = content_dir / "units" / f"unit{unit_num:02d}"
    unit_yaml = yaml.safe_load((unit_dir / "unit.yaml").read_text(encoding="utf-8"))

    qr_sections = compute_qr_sections(unit_yaml, app_config)
    qr_by_section = {qr.section_id: qr for qr in qr_sections}
    for qr in qr_sections:
        generate_qr_svg(qr.deep_link, qr_svg_dir / f"{qr.section_id}.svg")

    parts = [
        "#set page(paper: \"a4\", margin: 2.2cm)",
        "#set text(font: \"Noto Sans CJK JP\", size: 10.5pt, lang: \"ja\")",
        "#set heading(numbering: none)",
        "",
        f"= Unit {unit_yaml['unit']}: {escape_typst(unit_yaml['title'])}",
        f"#text(size: 9pt, fill: gray)[CEFR-J {unit_yaml.get('cefr_j', '')}]",
        "",
        "== Can-do",
        "",
    ]
    for cd in unit_yaml.get("can_do", []):
        parts.append(f"- *{cd['id']}*: {inline_md_to_typst(escape_typst(cd['ja']))}")
    parts.append("")

    for section in unit_yaml.get("sections", []):
        section_path = unit_dir / "sections" / f"{section['id']}.md"
        if not section_path.exists():
            continue
        meta, body = parse_frontmatter(section_path)
        title = meta.get("title_ja", section["id"])
        parts.append(f"== {escape_typst(title)}")
        parts.append(markdown_body_to_typst(body))

        qr = qr_by_section.get(section["id"])
        if qr is not None:
            svg_rel = f"{qr_svg_dir_relative}/{qr.section_id}.svg"
            parts.append("")
            parts.append("#grid(columns: (2.2cm, auto), gutter: 8pt, align: horizon,")
            parts.append(f'  image("{svg_rel}", width: 2.2cm),')
            parts.append(
                "  [#text(size: 8pt)[アプリで続ける] \\ "
                f"#text(size: 9pt, weight: \"bold\")[{qr.short_url}] \\ "
                f"#text(size: 7pt, fill: gray)[{escape_typst(qr.deep_link)}]],"
            )
            parts.append(")")

        parts.append("")
        parts.append("#pagebreak()")
        parts.append("")

    return "\n".join(parts), qr_sections


def compile_typst(typ_path: Path, pdf_path: Path) -> None:
    if shutil.which("typst") is None:
        raise EnvironmentError(
            f"`typst` is not installed in this environment, so {typ_path.name} could not "
            f"be compiled to PDF. Install it (https://github.com/typst/typst#installation) "
            f"and re-run: typst compile {typ_path} {pdf_path}"
        )
    subprocess.run(["typst", "compile", str(typ_path), str(pdf_path)], check=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--content-dir", type=Path, default=DEFAULT_CONTENT_DIR)
    parser.add_argument("--build-dir", type=Path, default=DEFAULT_BUILD_DIR)
    parser.add_argument("--qr-map", type=Path, default=DEFAULT_QR_MAP_PATH)
    parser.add_argument("--unit", type=int, required=True)
    parser.add_argument("--typ-only", action="store_true", help="generate the .typ source but do not compile")
    args = parser.parse_args(argv)

    args.build_dir.mkdir(parents=True, exist_ok=True)
    app_config = load_app_config(args.content_dir)

    qr_svg_dir_relative = f"qr/unit{args.unit:02d}"
    qr_svg_dir = args.build_dir / qr_svg_dir_relative
    typst_source, qr_sections = render_unit_typst(
        args.content_dir, args.unit, app_config, qr_svg_dir, qr_svg_dir_relative
    )

    typ_path = args.build_dir / f"unit{args.unit:02d}.typ"
    typ_path.write_text(typst_source, encoding="utf-8")
    print(f"wrote {typ_path}")

    if qr_sections:
        write_qr_manifest(args.qr_map, qr_sections)
        print(f"wrote {len(qr_sections)} QR code(s) under {qr_svg_dir}, updated {args.qr_map}")

    if args.typ_only:
        return 0

    pdf_path = args.build_dir / f"unit{args.unit:02d}.pdf"
    try:
        compile_typst(typ_path, pdf_path)
    except EnvironmentError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(f"wrote {pdf_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
