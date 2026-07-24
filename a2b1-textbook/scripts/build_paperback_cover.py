#!/usr/bin/env python3
"""Generate a KDP paperback full-wrap cover (back + spine + front, with
bleed) as a print-ready PDF via Typst.

STATUS: this is a programmatic placeholder, not a professional cover
design -- see build_cover.py's docstring for the same caveat about the
ebook cover. It exists so there is *a* valid, correctly-dimensioned
wrap PDF to iterate on or hand to a designer, not a final asset.

Spine width depends on final page count, which this script takes as
`--pages` (get it by running `typst compile build/pdf/full-book.typ` and
checking the resulting page count, e.g. via `typst compile --format png
... | wc -l` on the per-page PNG output). The formula used here
(page_count * 0.0025in for white paper) is a commonly cited estimate,
NOT an authoritative KDP figure -- verify the real spine width against
KDP's own cover calculator (in the KDP dashboard, at upload time) before
finalizing, and re-run this script with the corrected value if it
differs meaningfully.

Usage:
    python3 scripts/build_paperback_cover.py --pages 199
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTENT_DIR = REPO_ROOT / "content"
DEFAULT_OUT_DIR = REPO_ROOT / "build" / "cover"

BLEED_IN = 0.125
SPINE_WIDTH_PER_PAGE_IN = 0.0025  # white paper estimate -- see docstring

BACK_COVER_BLURB = (
    "CEFR A2（英検準2級〜2級・TOEIC 400〜550）から B1 へ。教師なしで進められる、"
    "4技能総合英語トレーニングです。\n\n"
    "全20ユニットは第二言語習得研究に基づいた7ステップ構成。語彙は「既習語＋新出語」で"
    "98%以上をカバーするよう設計されており、辞書なしでも無理なく読み進められます。\n\n"
    "紙面のQRコードから無料のウェブアプリに接続すれば、リスニング・シャドーイング・"
    "AIとの対話ロールプレイ・語彙の間隔反復復習まで一冊で完結します。"
)


def compute_spine_width_in(page_count: int) -> float:
    return round(page_count * SPINE_WIDTH_PER_PAGE_IN, 4)


def render_wrap_cover_typst(book_meta: dict, page_count: int) -> tuple[str, dict]:
    trim = book_meta["trim_size"]
    trim_w = trim["width_in"]
    trim_h = trim["height_in"]
    spine_w = compute_spine_width_in(page_count)

    canvas_w = 2 * trim_w + spine_w + 2 * BLEED_IN
    canvas_h = trim_h + 2 * BLEED_IN

    # Panel x-offsets from the left edge of the canvas.
    back_x = 0.0
    spine_x = trim_w + BLEED_IN
    front_x = trim_w + spine_w + BLEED_IN

    dims = {
        "canvas_w": canvas_w,
        "canvas_h": canvas_h,
        "spine_w": spine_w,
        "back_x": back_x,
        "spine_x": spine_x,
        "front_x": front_x,
    }

    ink = "rgb(\"#ededea\")"
    soft = "rgb(\"#a7b0ac\")"
    accent = "rgb(\"#64c4cc\")"
    bg = "rgb(\"#14191a\")"

    blurb_escaped = BACK_COVER_BLURB.replace("\\", "\\\\").replace("#", "\\#").replace("_", "\\_")
    blurb_lines = [f"  {line}" if line else "" for line in blurb_escaped.split("\n")]
    blurb_block = "\n\n".join(l for l in blurb_lines if l.strip()) or ""

    parts = [
        f'#set page(width: {canvas_w}in, height: {canvas_h}in, margin: 0pt, fill: {bg})',
        '#set text(font: "Noto Sans CJK JP", lang: "ja")',
        "",
        f"// whole-canvas background",
        f"#place(top + left, rect(width: 100%, height: 100%, fill: {bg}))",
        "",
        f"// --- back cover panel ---",
        f"#place(top + left, dx: {back_x}in + {BLEED_IN}in, dy: {BLEED_IN}in,",
        f"  box(width: {trim_w - BLEED_IN}in, height: {trim_h}in)[",
        f'    #text(size: 10pt, fill: {ink})[',
        f"{blurb_block}",
        "    ]",
        "    #v(1fr)",
        f'    #box(width: 2.2in, height: 1.3in, stroke: 0.5pt + {soft})[',
        f'      #align(center + horizon)[#text(size: 8pt, fill: {soft})[（KDPバーコード用の余白）]]',
        "    ]",
        "  ]",
        ")",
        "",
        f"// --- spine panel ---",
        f"#place(top + left, dx: {spine_x}in, dy: {BLEED_IN}in,",
        f"  box(width: {spine_w}in, height: {trim_h}in)[",
        f"    #align(center + horizon)[",
        f"      #rotate(-90deg, reflow: true)[",
        f'        #text(size: 13pt, weight: "bold", fill: {ink})[{escape(book_meta["title"])}]',
        f'        #h(0.4in)',
        f'        #text(size: 9pt, fill: {soft})[{escape(book_meta["publisher"])}]',
        "      ]",
        "    ]",
        "  ]",
        ")",
        "",
        f"// --- front cover panel ---",
        f"#place(top + left, dx: {front_x}in, dy: {BLEED_IN}in,",
        f"  box(width: {trim_w}in, height: {trim_h}in)[",
        f"    #v(2.2in)",
        f"    #align(center)[",
        f'      #text(size: 30pt, weight: "bold", fill: {ink})[{escape(book_meta["title"])}]',
        "      #v(0.5cm)",
        f'      #text(size: 14pt, fill: {soft})[{escape(book_meta["subtitle"])}]',
        "    ]",
        "    #v(1fr)",
        f"    #align(center)[#text(size: 12pt, fill: {ink})[{escape(book_meta['author'])}]]",
        "    #v(0.6in)",
        "  ]",
        ")",
        f"#place(top + left, dx: {front_x}in, dy: {BLEED_IN}in, rect(width: {trim_w}in, height: 0.1in, fill: {accent}))",
        f"#place(top + left, dx: {front_x}in, dy: {BLEED_IN + trim_h - 0.1}in, rect(width: {trim_w}in, height: 0.1in, fill: {accent}))",
    ]
    return "\n".join(parts), dims


def escape(text: str) -> str:
    for ch in ("\\", "#", "@", "$", "_"):
        text = text.replace(ch, "\\" + ch)
    return text


def compile_typst(typ_path: Path, pdf_path: Path) -> None:
    if shutil.which("typst") is None:
        raise EnvironmentError(
            f"`typst` is not installed. Install it (https://github.com/typst/typst#installation) "
            f"and re-run: typst compile {typ_path} {pdf_path}"
        )
    subprocess.run(["typst", "compile", str(typ_path), str(pdf_path)], check=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--content-dir", type=Path, default=DEFAULT_CONTENT_DIR)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--pages", type=int, required=True, help="final interior page count of full-book.pdf")
    parser.add_argument("--typ-only", action="store_true")
    args = parser.parse_args(argv)

    book_meta = yaml.safe_load((args.content_dir / "book_meta.yaml").read_text(encoding="utf-8"))
    source, dims = render_wrap_cover_typst(book_meta, args.pages)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    typ_path = args.out_dir / "paperback-wrap-cover.typ"
    typ_path.write_text(source, encoding="utf-8")
    print(f"wrote {typ_path}")
    print(
        f"  canvas: {dims['canvas_w']:.3f}in x {dims['canvas_h']:.3f}in "
        f"(spine width: {dims['spine_w']:.4f}in for {args.pages} pages -- VERIFY against KDP's calculator)"
    )

    if args.typ_only:
        return 0

    pdf_path = args.out_dir / "paperback-wrap-cover.pdf"
    try:
        compile_typst(typ_path, pdf_path)
    except EnvironmentError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(f"wrote {pdf_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
