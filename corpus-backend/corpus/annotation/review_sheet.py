"""Human-in-the-loop review sheet: the half-automation of WER measurement.

The machine does everything except the one thing only a human can: say what was
actually said. ``write_review_sheet`` emits a CSV with the ASR hypothesis and an
empty ``corrected_transcript`` column (plus an ``ok`` shortcut); a verifier fills
it in; ``read_corrections`` ingests it back into a {segment_id: reference} map
for :func:`corpus.annotation.evaluation.measure_error_rates`.

Pure standard library (csv).
"""

from __future__ import annotations

import csv
import os

from .models import Segment
from .evaluation import confidence_band


_FIELDS = ["segment_id", "source_id", "speaker", "start_s", "end_s",
           "confidence", "band", "asr_transcript", "ok", "corrected_transcript"]


def write_review_sheet(segments: list[Segment], path: str,
                       edges=(0.5, 0.7, 0.9)) -> int:
    """Write a CSV for human verification. Returns the row count.

    Columns the verifier touches:
      * ``ok``: put any truthy value (1/x/yes) if the ASR transcript is correct
        as-is — saves retyping.
      * ``corrected_transcript``: the true transcript if ``ok`` is empty.
    """
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    n = 0
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=_FIELDS)
        w.writeheader()
        for s in segments:
            tr = s.transcript
            w.writerow({
                "segment_id": s.segment_id,
                "source_id": s.source_id,
                "speaker": s.speaker,
                "start_s": round(s.start_s, 3),
                "end_s": round(s.end_s, 3),
                "confidence": ("" if not tr or tr.confidence is None
                               else round(tr.confidence, 4)),
                "band": confidence_band(s, edges),
                "asr_transcript": (tr.text if tr and tr.text else ""),
                "ok": "",
                "corrected_transcript": "",
            })
            n += 1
    return n


def _is_truthy(v: str) -> bool:
    return str(v).strip().lower() in {"1", "x", "y", "yes", "true", "ok"}


def read_corrections(path: str) -> dict[str, str]:
    """Read a filled review sheet back into {segment_id: reference_transcript}.

    Resolution per row:
      * ``ok`` truthy  -> reference = the ASR transcript (verified correct).
      * else corrected_transcript non-empty -> reference = that.
      * else            -> row skipped (not yet reviewed).
    """
    out: dict[str, str] = {}
    with open(path, "r", encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            seg_id = (row.get("segment_id") or "").strip()
            if not seg_id:
                continue
            corrected = (row.get("corrected_transcript") or "").strip()
            if _is_truthy(row.get("ok", "")):
                out[seg_id] = (row.get("asr_transcript") or "").strip()
            elif corrected:
                out[seg_id] = corrected
            # otherwise: unreviewed, skip
    return out


def review_progress(path: str) -> dict:
    """Summarise how much of a review sheet has been completed."""
    total = reviewed = 0
    with open(path, "r", encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            if not (row.get("segment_id") or "").strip():
                continue
            total += 1
            if (_is_truthy(row.get("ok", "")) or
                    (row.get("corrected_transcript") or "").strip()):
                reviewed += 1
    return {"total": total, "reviewed": reviewed,
            "remaining": total - reviewed,
            "fraction": round(reviewed / total, 4) if total else 0.0}
