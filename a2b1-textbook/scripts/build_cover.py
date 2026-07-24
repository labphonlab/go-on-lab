#!/usr/bin/env python3
"""Generate a simple placeholder ebook cover (build/cover/ebook-cover.png)
from content/book_meta.yaml, using Pillow + the system's IPAGothic font
(the only CJK-capable font available in this environment).

STATUS: this is a programmatic placeholder, not a professional cover
design -- it exists so the EPUB/KDP submission has *a* valid cover
image to work with. Replace it (or the paperback wrap, which this script
does NOT generate -- see docs/kdp-metadata.md) with real design work
before publishing.

KDP's recommended ebook cover size is 1600x2560px (a 1:1.6 ratio); that's
what this script produces.

Usage:
    python3 scripts/build_cover.py
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTENT_DIR = REPO_ROOT / "content"
DEFAULT_OUT_PATH = REPO_ROOT / "build" / "cover" / "ebook-cover.png"

WIDTH, HEIGHT = 1600, 2560

# Same palette family as the Unit 1 prototype preview (teal accent on a
# warm paper ground), so cover / app / print share one visual identity.
BG_COLOR = (20, 25, 26)
ACCENT_COLOR = (100, 196, 204)
INK_COLOR = (237, 238, 233)
SOFT_COLOR = (167, 176, 172)

FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
]


def find_font_path() -> str:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    raise FileNotFoundError(
        "No CJK-capable font found. Install one (e.g. `apt-get install fonts-ipafont-gothic`) "
        "or point FONT_CANDIDATES at an available font before running this script."
    )


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in text:
        trial = current + ch
        if draw.textlength(trial, font=font) > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def build_cover(content_dir: Path, out_path: Path) -> Path:
    book_meta = yaml.safe_load((content_dir / "book_meta.yaml").read_text(encoding="utf-8"))
    font_path = find_font_path()

    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Thin accent rule near the top, echoing the print/app "strand" accent.
    draw.rectangle([(0, 0), (WIDTH, 14)], fill=ACCENT_COLOR)

    title_font = ImageFont.truetype(font_path, 96)
    subtitle_font = ImageFont.truetype(font_path, 46)
    author_font = ImageFont.truetype(font_path, 38)
    eyebrow_font = ImageFont.truetype(font_path, 34)

    margin = 140
    y = 420

    eyebrow = "CEFR A2 → B1"
    draw.text((margin, y), eyebrow, font=eyebrow_font, fill=ACCENT_COLOR)
    y += 90

    title_lines = wrap_text(draw, book_meta["title"], title_font, WIDTH - 2 * margin)
    for line in title_lines:
        draw.text((margin, y), line, font=title_font, fill=INK_COLOR)
        y += 118

    y += 40
    subtitle_lines = wrap_text(draw, book_meta["subtitle"], subtitle_font, WIDTH - 2 * margin)
    for line in subtitle_lines:
        draw.text((margin, y), line, font=subtitle_font, fill=SOFT_COLOR)
        y += 64

    draw.text((margin, HEIGHT - 220), book_meta["author"], font=author_font, fill=INK_COLOR)
    draw.rectangle([(0, HEIGHT - 14), (WIDTH, HEIGHT)], fill=ACCENT_COLOR)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG")
    return out_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--content-dir", type=Path, default=DEFAULT_CONTENT_DIR)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_PATH)
    args = parser.parse_args(argv)

    try:
        out_path = build_cover(args.content_dir, args.out)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(f"wrote {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
