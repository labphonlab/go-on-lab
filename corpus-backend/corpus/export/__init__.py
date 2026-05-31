"""Corpus export adapters for established research tools.

- praat:       Praat TextGrid (phonetics) — word/phone tiers
- elan:        ELAN EAF (multimodal annotation) — one tier per speaker
- hf_datasets: Hugging Face ``datasets`` audiofolder layout (ML training)

All are pure standard library, so a corpus can be exported with no extra
dependencies and loaded by the target tools as-is.
"""

from __future__ import annotations

import os

from .praat import export_textgrids
from .elan import export_eaf
from .hf_datasets import export_hf


def export_all(segments, out_dir: str, media_dir: str | None = None,
               accepted_only: bool = True) -> dict:
    """Write Praat, ELAN and HF exports under ``out_dir`` subfolders.

    Returns a dict of {format: count}.
    """
    sel = segments
    if accepted_only:
        from ..models import ItemState
        sel = [s for s in segments if s.state == ItemState.ACCEPTED]
    return {
        "praat": export_textgrids(sel, os.path.join(out_dir, "praat")),
        "elan": export_eaf(sel, os.path.join(out_dir, "elan"), media_dir),
        "hf": export_hf(segments, os.path.join(out_dir, "hf"),
                        accepted_only=accepted_only),
    }


__all__ = ["export_textgrids", "export_eaf", "export_hf", "export_all"]
