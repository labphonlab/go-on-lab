"""Local-directory source: ingest audio already on disk.

Fully offline — no network — so it is the reliable default and the path used in
tests and CI. Point it at a folder of WAVs (optionally with sidecar ``.txt``
transcripts of the same basename) and it produces SourceItems the registry can
acquire, hash and dedup.
"""

from __future__ import annotations

import os
import shutil
from typing import Iterator, Optional

from ..source import Source, SourceItem
from ...models import License


class LocalDirectorySource(Source):
    name = "local_dir"

    def __init__(self, root: str, language: str = "und",
                 license: License = License.CC0_1_0,
                 attribution: Optional[str] = None,
                 exts: tuple = (".wav",)):
        self.root = root
        self.language = language
        self.license = license
        self.attribution = attribution
        self.exts = exts

    def catalog(self, limit: Optional[int] = None, **query) -> Iterator[SourceItem]:
        n = 0
        for dirpath, _dirs, files in os.walk(self.root):
            for fname in sorted(files):
                if not fname.lower().endswith(self.exts):
                    continue
                path = os.path.join(dirpath, fname)
                stem = os.path.splitext(path)[0]
                transcript = None
                txt = stem + ".txt"
                if os.path.exists(txt):
                    with open(txt, "r", encoding="utf-8") as fh:
                        transcript = fh.read().strip()
                rel = os.path.relpath(path, self.root)
                yield SourceItem(
                    item_id=rel.replace(os.sep, "/"),
                    source=self.name, audio_url=path, language=self.language,
                    license=self.license, title=os.path.basename(stem),
                    attribution=self.attribution, transcript=transcript,
                )
                n += 1
                if limit is not None and n >= limit:
                    return

    def fetch(self, item: SourceItem, dest_dir: str) -> str:
        """Copy the local file into the registry's audio store."""
        safe = item.item_id.replace("/", "__")
        dest = os.path.join(dest_dir, safe)
        if os.path.abspath(item.audio_url) != os.path.abspath(dest):
            shutil.copy2(item.audio_url, dest)
        return dest
