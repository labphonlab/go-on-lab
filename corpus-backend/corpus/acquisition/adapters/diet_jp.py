"""Japanese Diet source: broadcast audio + verbatim record (Tier-1 JA target).

The 国会会議録検索システム exposes a verbatim record via a documented JSON API,
and Diet sessions are broadcast/archived with audio. Crucially the **verbatim
text is not time-aligned to the audio** and has no phonetic/prosodic analysis —
the prime "text exists, labels/analysis don't" case for Japanese.

The verbatim-record API (text) is straightforward; aligning it to the broadcast
audio is the value this system adds. The audio-retrieval step depends on the
chosen archive and is wired in a later milestone, so ``fetch`` raises clearly
rather than guessing a URL scheme.

API: https://kokkai.ndl.go.jp/api.html  (会議単位・発言単位 JSON)
"""

from __future__ import annotations

import json
from typing import Iterator, Optional
from urllib.parse import urlencode
from urllib.request import urlopen, Request

from ..source import Source, SourceItem
from ...models import License

_RECORD_API = "https://kokkai.ndl.go.jp/api/meeting"
_UA = {"User-Agent": "go-on-lab-corpus/0.1 (research)"}


class DietJapanSource(Source):
    name = "diet_jp"

    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout

    def catalog(self, limit: Optional[int] = None, **query) -> Iterator[SourceItem]:
        """List meetings with verbatim text. ``query`` passes through API params
        (e.g. ``from``/``until`` dates, ``nameOfHouse``)."""
        params = {"recordPacking": "json", "maximumRecords": min(limit or 10, 30)}
        params.update(query)
        url = f"{_RECORD_API}?{urlencode(params)}"
        req = Request(url, headers=_UA)
        with urlopen(req, timeout=self.timeout) as resp:
            data = json.load(resp)
        for rec in data.get("meetingRecord", []):
            speeches = rec.get("speechRecord", [])
            transcript = "\n".join(s.get("speech", "") for s in speeches)
            yield SourceItem(
                item_id=rec.get("issueID", ""),
                source=self.name,
                audio_url="",  # audio archive URL resolved in a later milestone
                language="ja",
                license=License.CC0_1_0,  # government data; confirm exact terms
                title=f"{rec.get('nameOfHouse','')} {rec.get('nameOfMeeting','')} "
                      f"{rec.get('date','')}",
                attribution="国会会議録検索システム (NDL)",
                transcript=transcript or None,
                extra={"date": rec.get("date"),
                       "session": rec.get("session"),
                       "meetingURL": rec.get("meetingURL")},
            )

    def fetch(self, item: SourceItem, dest_dir: str) -> str:
        raise NotImplementedError(
            "Resolve and download the broadcast/archive audio for "
            f"{item.item_id!r} (date={item.extra.get('date')}). The verbatim "
            "transcript is already attached for forced alignment."
        )
