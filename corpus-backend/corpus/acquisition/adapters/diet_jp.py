"""Japanese Diet source: speaker-labeled verbatim record (Tier-1 JA target).

Two facts drive this adapter's design:

1. The 国会会議録検索システム API (kokkai.ndl.go.jp) serves the **verbatim record
   as text only** — it has no audio. The text is rich: every meeting is broken
   into per-speech records, each tagged with the **speaker's name**. That makes
   it a speaker-labeled transcript — i.e. potential **diarization ground truth**
   — which is exactly the under-labeled-but-valuable target we want.

2. Diet **audio/video lives in a separate system** (衆議院/参議院 中継) with **no
   official API keyed by the record's issueID**. There is therefore no reliable
   programmatic record→audio link; matching is by house+date+meeting name and is
   best treated as a manual/curated step.

So this adapter fully implements the text side (paginated fetch, per-speech
parsing, speaker extraction, editorial-mark cleaning) and models the audio side
honestly: ``audio_url`` is empty and ``fetch`` explains that audio must be
supplied out-of-band, rather than guessing a URL scheme that does not exist.

The HTTP layer is an injectable ``Opener`` so the whole client is tested offline.

APIs:
  * record (text): https://kokkai.ndl.go.jp/api.html  (会議単位 / 発言単位 JSON)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterator, Optional
from urllib.parse import urlencode

from ..source import Source, SourceItem
from ..net import Opener, urlopen_bytes, get_json
from ...models import License

_MEETING_API = "https://kokkai.ndl.go.jp/api/meeting"

# Leading editorial mark on each speech: "○安倍晋三君　…" — a circle, the
# speaker name, then a full-width space before the words.
_LEAD_MARK = re.compile(r"^[○◯●\s]+")
_SPEAKER_PREFIX = re.compile(r"^[○◯●\s]*([^　]{1,30}?)　")


@dataclass
class DietSpeech:
    """One speech within a meeting: a speaker and what they said."""

    order: int
    speaker: str
    text: str
    speech_id: str = ""

    def as_dict(self) -> dict:
        return {"order": self.order, "speaker": self.speaker,
                "speech_id": self.speech_id, "text": self.text}


def clean_speech(raw: str) -> str:
    """Strip the leading editorial mark + speaker prefix from a speech body."""
    if not raw:
        return ""
    # Remove a leading "○speaker　" prefix if present, else just the mark.
    m = _SPEAKER_PREFIX.match(raw)
    if m:
        return raw[m.end():].strip()
    return _LEAD_MARK.sub("", raw).strip()


def speeches_from_meeting(rec: dict) -> list[DietSpeech]:
    """Parse a meeting record's speechRecord list into typed speeches."""
    out: list[DietSpeech] = []
    for s in rec.get("speechRecord", []):
        speaker = (s.get("speaker") or "").strip()
        body = clean_speech(s.get("speech", ""))
        if not body:
            continue
        try:
            order = int(s.get("speechOrder", len(out)))
        except (TypeError, ValueError):
            order = len(out)
        out.append(DietSpeech(order=order, speaker=speaker, text=body,
                              speech_id=s.get("speechID", "")))
    return out


class DietJapanSource(Source):
    name = "diet_jp"

    # Soft cap per API request; the service paginates with startRecord.
    PAGE_SIZE = 10

    def __init__(self, opener: Opener | None = None, timeout: float = 30.0):
        self._opener: Opener = opener or (lambda u: urlopen_bytes(u, timeout))

    def catalog(self, limit: Optional[int] = None, **query) -> Iterator[SourceItem]:
        """Yield one SourceItem per meeting, with speaker-labeled transcript.

        ``query`` passes through kokkai params, e.g. ``from``/``until`` (dates),
        ``nameOfHouse`` (衆議院/参議院), ``nameOfMeeting`` (e.g. 予算委員会).
        """
        yielded = 0
        start = 1
        while True:
            page = min(self.PAGE_SIZE, (limit - yielded) if limit else self.PAGE_SIZE)
            params = {"recordPacking": "json", "maximumRecords": page,
                      "startRecord": start}
            params.update(query)
            data = get_json(self._opener, f"{_MEETING_API}?{urlencode(params)}")

            meetings = data.get("meetingRecord", [])
            for rec in meetings:
                yield self._to_item(rec)
                yielded += 1
                if limit is not None and yielded >= limit:
                    return

            # Pagination: the API returns the next start position, or omits it.
            nxt = data.get("nextRecordPosition")
            if not nxt or not meetings:
                return
            start = int(nxt)

    def _to_item(self, rec: dict) -> SourceItem:
        speeches = speeches_from_meeting(rec)
        transcript = "\n".join(sp.text for sp in speeches)
        speakers = sorted({sp.speaker for sp in speeches if sp.speaker})
        return SourceItem(
            item_id=rec.get("issueID", ""),
            source=self.name,
            audio_url="",  # no official record->audio API; supplied out-of-band
            language="ja",
            license=License.CC0_1_0,  # government data; confirm exact terms of use
            title=f"{rec.get('nameOfHouse','')} {rec.get('nameOfMeeting','')} "
                  f"{rec.get('date','')}".strip(),
            attribution="国会会議録検索システム (国立国会図書館)",
            transcript=transcript or None,
            extra={
                "date": rec.get("date"),
                "session": rec.get("session"),
                "house": rec.get("nameOfHouse"),
                "meeting": rec.get("nameOfMeeting"),
                "meetingURL": rec.get("meetingURL"),
                "speakers": speakers,
                "speeches": [sp.as_dict() for sp in speeches],
            },
        )

    def fetch(self, item: SourceItem, dest_dir: str) -> str:
        raise NotImplementedError(
            "The Diet record API provides text only. Audio for "
            f"{item.title!r} ({item.extra.get('date')}) lives in the 衆議院/参議院 "
            "中継 systems, which have no official API keyed by issueID. Supply the "
            "audio file out-of-band (e.g. via LocalDirectorySource) and align it "
            "against this speaker-labeled transcript; that alignment is the value "
            "this corpus adds."
        )
