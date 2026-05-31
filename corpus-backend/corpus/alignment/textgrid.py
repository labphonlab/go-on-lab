"""Minimal Praat TextGrid reader (the format MFA emits).

Parses interval tiers into typed intervals. Pure standard library, so MFA's
phone/word output can be ingested and analysed with no dependencies. Supports
the standard (non-short) TextGrid text format that MFA produces.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Interval:
    xmin: float
    xmax: float
    text: str

    @property
    def duration_s(self) -> float:
        return self.xmax - self.xmin

    def as_dict(self) -> dict:
        return {"start_s": round(self.xmin, 4), "end_s": round(self.xmax, 4),
                "label": self.text}


@dataclass
class Tier:
    name: str
    intervals: list[Interval]


_NUM = r"([-+]?[0-9]*\.?[0-9]+)"


class TextGrid:
    def __init__(self, tiers: list[Tier]):
        self.tiers = tiers

    def tier(self, name: str) -> Tier | None:
        for t in self.tiers:
            if t.name == name:
                return t
        return None

    @classmethod
    def parse(cls, text: str) -> "TextGrid":
        tiers: list[Tier] = []
        # Split into tier blocks; each "item [n]" with class IntervalTier.
        name = None
        cur: list[Interval] = []
        is_interval_tier = False

        def flush():
            nonlocal name, cur
            if name is not None and is_interval_tier:
                tiers.append(Tier(name=name, intervals=cur))
            name, cur = None, []

        lines = text.splitlines()
        i = 0
        pending = {}
        while i < len(lines):
            line = lines[i].strip()

            m = re.match(r'class\s*=\s*"(.*)"', line)
            if m:
                flush()
                is_interval_tier = (m.group(1) == "IntervalTier")
                i += 1
                continue

            m = re.match(r'name\s*=\s*"(.*)"', line)
            if m and name is None:
                name = m.group(1)
                i += 1
                continue

            if re.match(r'intervals\s*\[\d+\]\s*:', line):
                pending = {}
                i += 1
                continue

            m = re.match(rf'xmin\s*=\s*{_NUM}', line)
            if m:
                pending["xmin"] = float(m.group(1))
                i += 1
                continue
            m = re.match(rf'xmax\s*=\s*{_NUM}', line)
            if m:
                pending["xmax"] = float(m.group(1))
                i += 1
                continue
            m = re.match(r'text\s*=\s*"(.*)"\s*$', line)
            if m:
                pending["text"] = m.group(1)
                if "xmin" in pending and "xmax" in pending:
                    cur.append(Interval(pending["xmin"], pending["xmax"],
                                        pending["text"]))
                pending = {}
                i += 1
                continue
            i += 1

        flush()
        return cls(tiers)

    @classmethod
    def parse_file(cls, path: str) -> "TextGrid":
        with open(path, "r", encoding="utf-8") as fh:
            return cls.parse(fh.read())
