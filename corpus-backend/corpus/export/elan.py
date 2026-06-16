"""Export segments to ELAN EAF — the standard multimodal annotation format.

EAF is XML: a header pointing at the media, a shared pool of time slots, and
tiers of annotations referencing those slots. We emit one tier per speaker so an
annotator opening the file in ELAN sees the diarized, transcribed timeline.

Pure standard library (xml.etree). One EAF per source recording.
"""

from __future__ import annotations

import os
import xml.etree.ElementTree as ET

from ..annotation.models import Segment


def _eaf_for_source(source_id: str, segments: list[Segment],
                    media_path: str | None) -> ET.ElementTree:
    doc = ET.Element("ANNOTATION_DOCUMENT", {
        "AUTHOR": "go-on-lab", "DATE": "2026-01-01T00:00:00+09:00",
        "FORMAT": "3.0", "VERSION": "3.0",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    })

    header = ET.SubElement(doc, "HEADER", {
        "MEDIA_FILE": "", "TIME_UNITS": "milliseconds"})
    if media_path:
        ET.SubElement(header, "MEDIA_DESCRIPTOR", {
            "MEDIA_URL": f"file://{os.path.abspath(media_path)}",
            "MIME_TYPE": "audio/x-wav"})

    # Time order: unique millisecond marks -> ts ids.
    time_order = ET.SubElement(doc, "TIME_ORDER")
    slot_id: dict[int, str] = {}

    def slot(ms: int) -> str:
        if ms not in slot_id:
            sid = f"ts{len(slot_id) + 1}"
            slot_id[ms] = sid
        return slot_id[ms]

    # Build annotations grouped by speaker; allocate slots in time order.
    per_speaker: dict[str, list[Segment]] = {}
    for s in sorted(segments, key=lambda x: x.start_s):
        per_speaker.setdefault(s.speaker or "UNKNOWN", []).append(s)

    # Pre-create slots sorted by time so TIME_ORDER is monotonic (ELAN expects it).
    marks = sorted({int(round(s.start_s * 1000)) for s in segments} |
                   {int(round(s.end_s * 1000)) for s in segments})
    for ms in marks:
        slot(ms)
    for ms in marks:
        ET.SubElement(time_order, "TIME_SLOT",
                      {"TIME_SLOT_ID": slot_id[ms], "TIME_VALUE": str(ms)})

    ann_id = 0
    for speaker, segs in per_speaker.items():
        tier = ET.SubElement(doc, "TIER", {
            "LINGUISTIC_TYPE_REF": "utterance",
            "TIER_ID": speaker, "PARTICIPANT": speaker})
        for s in segs:
            ann_id += 1
            ann = ET.SubElement(tier, "ANNOTATION")
            align = ET.SubElement(ann, "ALIGNABLE_ANNOTATION", {
                "ANNOTATION_ID": f"a{ann_id}",
                "TIME_SLOT_REF1": slot(int(round(s.start_s * 1000))),
                "TIME_SLOT_REF2": slot(int(round(s.end_s * 1000)))})
            val = ET.SubElement(align, "ANNOTATION_VALUE")
            val.text = (s.transcript.text if s.transcript and s.transcript.text
                        else "")

    ET.SubElement(doc, "LINGUISTIC_TYPE", {
        "GRAPHIC_REFERENCES": "false", "LINGUISTIC_TYPE_ID": "utterance",
        "TIME_ALIGNABLE": "true"})
    return ET.ElementTree(doc)


def export_eaf(segments: list[Segment], out_dir: str,
               media_dir: str | None = None) -> int:
    """Write one .eaf per source recording. Returns the file count.

    If ``media_dir`` is given, each EAF links to ``{media_dir}/{source_id}.wav``.
    """
    os.makedirs(out_dir, exist_ok=True)
    by_source: dict[str, list[Segment]] = {}
    for s in segments:
        by_source.setdefault(s.source_id, []).append(s)
    n = 0
    for source_id, segs in by_source.items():
        safe = source_id.replace("/", "__").replace("#", "_")
        media = (os.path.join(media_dir, f"{safe}.wav") if media_dir else None)
        tree = _eaf_for_source(source_id, segs, media)
        ET.indent(tree, space="  ")
        tree.write(os.path.join(out_dir, f"{safe}.eaf"),
                   encoding="utf-8", xml_declaration=True)
        n += 1
    return n
