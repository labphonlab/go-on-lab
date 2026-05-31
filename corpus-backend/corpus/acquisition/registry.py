"""Acquisition registry: provenance, dedup and manifest over Sources.

Wraps any :class:`~corpus.acquisition.source.Source` to:
  * record where each item came from (source, licence, attribution, URL),
  * skip duplicates by content hash so re-running an acquisition is idempotent,
  * write an acquisition manifest the annotation pipeline then consumes.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field, asdict
from typing import Iterable, Optional

from .source import Source, SourceItem
from ..models import License


def _sha256(path: str, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            b = fh.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


@dataclass
class AcquiredItem:
    item_id: str
    source: str
    local_path: str
    language: str
    license: str
    sha256: str
    bytes: int
    title: Optional[str] = None
    attribution: Optional[str] = None
    transcript: Optional[str] = None
    audio_url: Optional[str] = None
    acquired_at: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class AcquisitionRegistry:
    def __init__(self, store_dir: str):
        self.store_dir = store_dir
        self.audio_dir = os.path.join(store_dir, "audio")
        self.manifest_path = os.path.join(store_dir, "acquisition.jsonl")
        os.makedirs(self.audio_dir, exist_ok=True)
        self._hashes: set[str] = set()
        self._items: list[AcquiredItem] = []
        self._load_existing()

    def _load_existing(self) -> None:
        if not os.path.exists(self.manifest_path):
            return
        with open(self.manifest_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                self._hashes.add(rec["sha256"])
                self._items.append(AcquiredItem(**rec))

    def acquire(self, source: Source, item: SourceItem) -> Optional[AcquiredItem]:
        """Fetch one item, dedup by content hash, append to manifest.

        Returns the AcquiredItem, or ``None`` if it was a duplicate.
        """
        import datetime as _dt

        local_path = source.fetch(item, self.audio_dir)
        digest = _sha256(local_path)
        if digest in self._hashes:
            # Identical content already acquired; drop the redundant download.
            if os.path.dirname(local_path) == self.audio_dir:
                try:
                    os.remove(local_path)
                except OSError:
                    pass
            return None

        acquired = AcquiredItem(
            item_id=item.item_id, source=item.source, local_path=local_path,
            language=item.language, license=item.license.value, sha256=digest,
            bytes=os.path.getsize(local_path), title=item.title,
            attribution=item.attribution, transcript=item.transcript,
            audio_url=item.audio_url,
            acquired_at=_dt.datetime.now(_dt.timezone.utc).isoformat(),
        )
        self._hashes.add(digest)
        self._items.append(acquired)
        with open(self.manifest_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(acquired.to_dict(), ensure_ascii=False) + "\n")
        return acquired

    def acquire_from(self, source: Source, limit: Optional[int] = None,
                     **query) -> list[AcquiredItem]:
        """Catalog a source and acquire up to ``limit`` new (non-duplicate) items."""
        out: list[AcquiredItem] = []
        for item in source.catalog(limit=limit, **query):
            got = self.acquire(source, item)
            if got is not None:
                out.append(got)
                if limit is not None and len(out) >= limit:
                    break
        return out

    @property
    def items(self) -> list[AcquiredItem]:
        return list(self._items)

    def license_summary(self) -> dict:
        from collections import Counter
        return dict(Counter(i.license for i in self._items))
