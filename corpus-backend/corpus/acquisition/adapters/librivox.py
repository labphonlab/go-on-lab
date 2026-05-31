"""LibriVox source: public-domain audiobooks (Tier-1 target).

LibriVox recordings are **public domain**, and most of the catalog has never
been time-aligned or phonetically analysed — exactly the "easy to obtain,
under-labeled" niche. Text comes from Project Gutenberg (also PD).

Network access (urllib, stdlib) and the LibriVox JSON API are used only when
``catalog``/``fetch`` run, so importing this module costs nothing. The API
shape is encapsulated here so the rest of the system stays source-agnostic.

API: https://librivox.org/api/info  (feed/audiobooks, JSON)
"""

from __future__ import annotations

import json
import os
from typing import Iterator, Optional
from urllib.parse import urlencode
from urllib.request import urlopen, Request

from ..source import Source, SourceItem
from ...models import License

_API = "https://librivox.org/api/feed/audiobooks"
_UA = {"User-Agent": "go-on-lab-corpus/0.1 (research)"}


class LibriVoxSource(Source):
    name = "librivox"

    def __init__(self, language: str = "en", timeout: float = 30.0):
        self.language = language
        self.timeout = timeout

    def catalog(self, limit: Optional[int] = None, **query) -> Iterator[SourceItem]:
        params = {"format": "json", "limit": limit or 50,
                  "extended": 1, "coverage": "complete"}
        params.update(query)
        url = f"{_API}?{urlencode(params)}"
        req = Request(url, headers=_UA)
        with urlopen(req, timeout=self.timeout) as resp:
            data = json.load(resp)
        for book in data.get("books", []):
            zip_url = book.get("url_zip_file")
            if not zip_url:
                continue
            yield SourceItem(
                item_id=str(book.get("id")),
                source=self.name, audio_url=zip_url, language=self.language,
                license=License.CC0_1_0,  # PD; treated as CC0-equivalent here
                title=book.get("title"),
                attribution=f"LibriVox / {book.get('title')} (public domain)",
                transcript_url=book.get("url_text_source"),
                duration_s=_to_seconds(book.get("totaltimesecs")),
                extra={"gutenberg": book.get("url_text_source")},
            )

    def fetch(self, item: SourceItem, dest_dir: str) -> str:
        dest = os.path.join(dest_dir, f"librivox_{item.item_id}.zip")
        req = Request(item.audio_url, headers=_UA)
        with urlopen(req, timeout=self.timeout) as resp, open(dest, "wb") as out:
            while True:
                chunk = resp.read(1 << 16)
                if not chunk:
                    break
                out.write(chunk)
        return dest


def _to_seconds(v) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None
