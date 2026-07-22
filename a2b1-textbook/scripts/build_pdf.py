#!/usr/bin/env python3
"""Render a unit's content/units/unitNN/{unit.yaml,sections/*.md} into a
Typst source file, then compile it to PDF.

STATUS: the Markdown -> Typst source generation is fully implemented and
runs without any external tools. The final PDF compile step shells out to
the `typst` CLI, which is NOT installed in this sandbox -- that step will
raise a clear error naming the missing binary and how to install it
(https://github.com/typst/typst#installation). Run with --typ-only to
generate build/pdf/unitNN.typ without attempting compilation.

The Markdown -> Typst conversion here is intentionally simple (headings,
bold, tables, horizontal rules, blank-line paragraphs) since unit content
is authored in a constrained subset of Markdown by design (see
content/units/unit01/sections/*.md). It is not a general Markdown
converter.

Usage:
    python3 scripts/build_pdf.py --unit 1                # .typ + PDF
    python3 scripts/build_pdf.py --unit 1 --typ-only      # .typ only
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTENT_DIR = REPO_ROOT / "content"
DEFAULT_BUILD_DIR = REPO_ROOT / "build" / "pdf"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
TABLE_ROW_RE = re.compile(r"^\|(.+)\|$")


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


def render_unit_typst(content_dir: Path, unit_num: int) -> str:
    unit_dir = content_dir / "units" / f"unit{unit_num:02d}"
    unit_yaml = yaml.safe_load((unit_dir / "unit.yaml").read_text(encoding="utf-8"))

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
        parts.append("")
        parts.append("#pagebreak()")
        parts.append("")

    return "\n".join(parts)


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
    parser.add_argument("--unit", type=int, required=True)
    parser.add_argument("--typ-only", action="store_true", help="generate the .typ source but do not compile")
    args = parser.parse_args(argv)

    args.build_dir.mkdir(parents=True, exist_ok=True)
    typst_source = render_unit_typst(args.content_dir, args.unit)

    typ_path = args.build_dir / f"unit{args.unit:02d}.typ"
    typ_path.write_text(typst_source, encoding="utf-8")
    print(f"wrote {typ_path}")

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
