"""Montreal Forced Aligner (MFA) integration for phone-level boundaries.

MFA consumes audio + a transcript and emits a Praat TextGrid with word and phone
tiers. The heavy step (running MFA) is a lazy subprocess wrapper; the valuable,
testable logic is reading MFA's TextGrid output and attaching phones to our
segments — done here with the zero-dependency TextGrid parser.

MFA install (separate from pip; conda recommended):
    conda install -c conda-forge montreal-forced-aligner
    mfa model download acoustic english_mfa
    mfa model download dictionary english_mfa
"""

from __future__ import annotations

import os
import shutil
import subprocess
from typing import Optional

from .textgrid import TextGrid, Interval


def phones_from_textgrid(path: str, phone_tier: str = "phones") -> list[dict]:
    """Read an MFA TextGrid and return non-empty phone intervals as dicts."""
    tg = TextGrid.parse_file(path)
    tier = tg.tier(phone_tier) or (tg.tiers[-1] if tg.tiers else None)
    if tier is None:
        return []
    return [iv.as_dict() for iv in tier.intervals if iv.text.strip()]


def attach_phones(segments: list, textgrid_dir: str,
                  phone_tier: str = "phones") -> int:
    """Attach MFA phone alignments to segments by matching ``segment_id``.

    Expects ``{textgrid_dir}/{segment_id}.TextGrid`` (segment ids are filename
    -safe-encoded the same way they were written for MFA input). Returns the
    number of segments that received phones.
    """
    n = 0
    for seg in segments:
        safe = seg.segment_id.replace("/", "__").replace("#", "_")
        tg_path = os.path.join(textgrid_dir, f"{safe}.TextGrid")
        if os.path.exists(tg_path):
            seg.phones = phones_from_textgrid(tg_path, phone_tier)
            if seg.phones:
                n += 1
    return n


class MFANotFound(RuntimeError):
    pass


def have_mfa() -> bool:
    return shutil.which("mfa") is not None


def run_mfa_align(corpus_dir: str, dictionary: str, acoustic_model: str,
                  output_dir: str, *, clean: bool = True) -> str:
    """Run ``mfa align`` over a prepared corpus dir; return ``output_dir``.

    ``corpus_dir`` must contain paired ``<name>.wav`` + ``<name>.txt`` (or .lab)
    files, the layout MFA expects. Raises :class:`MFANotFound` if MFA is absent
    rather than pretending alignment happened.
    """
    if not have_mfa():
        raise MFANotFound(
            "Montreal Forced Aligner ('mfa') not found. Install via conda "
            "(conda-forge montreal-forced-aligner) and download an acoustic "
            "model + dictionary for your language.")
    os.makedirs(output_dir, exist_ok=True)
    cmd = ["mfa", "align"]
    if clean:
        cmd.append("--clean")
    cmd += [corpus_dir, dictionary, acoustic_model, output_dir]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise RuntimeError(
            f"mfa align failed ({proc.returncode}): "
            f"{proc.stderr.decode('utf-8', 'replace')[-800:]}")
    return output_dir
