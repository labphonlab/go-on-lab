"""Vowel-space scatter plot as SVG — pure standard library, no matplotlib.

Phonetic convention: F2 on the x-axis increasing leftward, F1 on the y-axis
increasing downward, so the plot mirrors the articulatory vowel quadrilateral
(high/front vowels top-right, low/back bottom-left). Plots each vowel category's
mean (large marker) with its target (ring), so a reader sees at a glance whether
the space is well-formed and on-target.
"""

from __future__ import annotations

from .vowel_space import VowelSpaceResult

# Palette cycled across vowel categories.
_COLORS = ["#1f77b4", "#d62728", "#2ca02c", "#9467bd", "#ff7f0e", "#17becf",
           "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22"]


def _scale(value, lo, hi, out_lo, out_hi):
    if hi == lo:
        return (out_lo + out_hi) / 2
    return out_lo + (value - lo) * (out_hi - out_lo) / (hi - lo)


def vowel_space_svg(result: VowelSpaceResult, width: int = 520, height: int = 420,
                    title: str = "Vowel space (F1/F2)") -> str:
    """Render the measured vowel space (and targets) as a standalone SVG string."""
    cats = [c for c in result.categories
            if c.f1.get("n", 0) > 0 and c.f2.get("n", 0) > 0]

    # Axis ranges from data + targets, padded; default to typical vowel ranges.
    f1_vals, f2_vals = [], []
    for c in cats:
        f1_vals.append(c.f1["mean"])
        f2_vals.append(c.f2["mean"])
        if c.target:
            f1_vals.append(c.target[0])
            f2_vals.append(c.target[1])
    f1_lo, f1_hi = (min(f1_vals + [250]), max(f1_vals + [900]))
    f2_lo, f2_hi = (min(f2_vals + [700]), max(f2_vals + [2400]))
    pad1 = (f1_hi - f1_lo) * 0.12 + 1
    pad2 = (f2_hi - f2_lo) * 0.12 + 1
    f1_lo, f1_hi = f1_lo - pad1, f1_hi + pad1
    f2_lo, f2_hi = f2_lo - pad2, f2_hi + pad2

    m = 60  # margin
    plot_w, plot_h = width - 2 * m, height - 2 * m

    # F2 increases leftward: high F2 -> small x. F1 increases downward: high F1 -> large y.
    def px(f2):
        return m + _scale(f2, f2_hi, f2_lo, 0, plot_w)

    def py(f1):
        return m + _scale(f1, f1_lo, f1_hi, 0, plot_h)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" '
        f'height="{height}" viewBox="0 0 {width} {height}" font-family="sans-serif">',
        f'<rect width="{width}" height="{height}" fill="white"/>',
        f'<text x="{width/2}" y="24" text-anchor="middle" font-size="16" '
        f'font-weight="bold">{_esc(title)}</text>',
        # axes box
        f'<rect x="{m}" y="{m}" width="{plot_w}" height="{plot_h}" '
        f'fill="none" stroke="#888" stroke-width="1"/>',
        # axis labels
        f'<text x="{m+plot_w/2}" y="{height-18}" text-anchor="middle" '
        f'font-size="12">F2 (Hz) →← higher front</text>',
        f'<text x="18" y="{m+plot_h/2}" text-anchor="middle" font-size="12" '
        f'transform="rotate(-90 18 {m+plot_h/2})">F1 (Hz) ↓ lower / more open</text>',
        # corner ticks
        f'<text x="{m}" y="{m-6}" font-size="10" fill="#666">F2={int(f2_hi)}</text>',
        f'<text x="{m+plot_w}" y="{m-6}" text-anchor="end" font-size="10" '
        f'fill="#666">F2={int(f2_lo)}</text>',
        f'<text x="{m-6}" y="{m+8}" text-anchor="end" font-size="10" '
        f'fill="#666">F1={int(f1_lo)}</text>',
        f'<text x="{m-6}" y="{m+plot_h}" text-anchor="end" font-size="10" '
        f'fill="#666">F1={int(f1_hi)}</text>',
    ]

    for i, c in enumerate(cats):
        color = _COLORS[i % len(_COLORS)]
        x, y = px(c.f2["mean"]), py(c.f1["mean"])
        # target ring + connector
        if c.target:
            tx, ty = px(c.target[1]), py(c.target[0])
            parts.append(f'<circle cx="{tx:.1f}" cy="{ty:.1f}" r="9" '
                         f'fill="none" stroke="{color}" stroke-width="1.5" '
                         f'stroke-dasharray="3,2"/>')
            parts.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{tx:.1f}" '
                         f'y2="{ty:.1f}" stroke="{color}" stroke-width="0.8" '
                         f'stroke-dasharray="2,2"/>')
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="{color}" '
                     f'fill-opacity="0.8"/>')
        parts.append(f'<text x="{x+9:.1f}" y="{y+4:.1f}" font-size="13" '
                     f'font-weight="bold" fill="{color}">{_esc(c.vowel)}</text>')

    # legend / verdict
    verdict = ("ordering OK" if result.ordering_ok else
               "ORDERING WRONG" if result.ordering_ok is False else "ordering n/a")
    err = ("" if result.mean_target_error_hz is None
           else f" · mean target error {result.mean_target_error_hz:.0f} Hz")
    parts.append(f'<text x="{m}" y="{height-2}" font-size="11" fill="#444">'
                 f'{result.n_vowels_measured} vowels · {_esc(verdict)}{_esc(err)} · '
                 f'dashed ring = target</text>')
    parts.append("</svg>")
    return "\n".join(parts)


def _esc(s: str) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def write_vowel_space_svg(result: VowelSpaceResult, path: str, **kw) -> str:
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(vowel_space_svg(result, **kw))
    return path
