"""Intermediate representation (第2層) — the single contract between the
analysis layer and the generation layer. Nothing downstream may depend on
anything but this JSON shape.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional


CONTENT_TYPES = (
    "vocabulary_list",
    "dialogue",
    "grammar_note",
    "reading_passage",
    "pattern_drill",
)

CONTENT_TYPE_METHODS = {
    "vocabulary_list": ["flashcard", "listening_choice"],
    "dialogue": ["dictation", "shadowing", "roleplay"],
    "grammar_note": ["structured_input", "cloze_drill", "reorder_drill"],
    "reading_passage": ["karaoke_reading", "comprehension_check"],
    "pattern_drill": ["substitution_drill"],
}


@dataclass
class AudioRef:
    file: str
    start: float
    end: float

    def to_dict(self) -> dict:
        return {"file": self.file, "start": round(self.start, 3), "end": round(self.end, 3)}


@dataclass
class Item:
    id: str
    text: str
    ja: str = ""
    ipa: str = ""
    pos: str = ""
    speaker: str = ""  # dialogue turns only — which of the conversation's speakers this line belongs to
    audio: Optional[AudioRef] = None
    difficulty_flags: list = field(default_factory=list)
    alignment_confidence: Optional[float] = None
    priority_score: Optional[float] = None
    # Word-level neighborhood density (analysis/neighborhood.py), populated
    # only for single-word items — ND isn't well-defined for a whole
    # sentence. None also covers "word not in CMUdict", distinguished in
    # report.md's OOV list rather than in this field.
    nd: Optional[int] = None
    nd_l1_weighted: Optional[int] = None
    # Set only when classify.py corrected/completed/restructured this item's
    # text relative to what was actually in the source file (see classify.py's
    # system prompt) — original_text is the as-extracted version, revision_note
    # is a one-line reason. Both empty means "text is exactly what was extracted."
    original_text: str = ""
    revision_note: str = ""

    def to_dict(self) -> dict:
        d = {
            "id": self.id,
            "text": self.text,
            "ipa": self.ipa,
            "ja": self.ja,
            "difficulty_flags": list(self.difficulty_flags),
        }
        if self.pos:
            d["pos"] = self.pos
        if self.speaker:
            d["speaker"] = self.speaker
        if self.revision_note:
            d["original_text"] = self.original_text
            d["revision_note"] = self.revision_note
        if self.audio is not None:
            d["audio"] = self.audio.to_dict()
        if self.priority_score is not None:
            d["priority_score"] = self.priority_score
        if self.nd is not None:
            d["nd"] = self.nd
        if self.nd_l1_weighted is not None:
            d["nd_l1_weighted"] = self.nd_l1_weighted
        if self.alignment_confidence is not None:
            d["alignment_confidence"] = round(self.alignment_confidence, 3)
        return d


@dataclass
class Section:
    id: str
    content_type: str
    title: str = ""
    learning_methods: list = field(default_factory=list)
    rationale: str = ""
    items: list = field(default_factory=list)  # list[Item]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "content_type": self.content_type,
            "learning_methods": list(self.learning_methods),
            "rationale": self.rationale,
            "items": [it.to_dict() for it in self.items],
        }


@dataclass
class Course:
    title: str
    level: str
    source_files: list = field(default_factory=list)
    lang: str = "en"
    sections: list = field(default_factory=list)  # list[Section]

    def to_dict(self) -> dict:
        return {
            "meta": {
                "title": self.title,
                "level": self.level,
                "lang": self.lang,
                "source_files": list(self.source_files),
            },
            "sections": [s.to_dict() for s in self.sections],
        }
