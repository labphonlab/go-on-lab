"""VoxPopuli source: CC0 European-Parliament speech, large unlabeled subset.

VoxPopuli ships ~100k hours of **unlabeled** multilingual audio under CC0 — a
strong "easy to obtain, under-labeled" target for adding our own labels. The
official tooling (facebookresearch/voxpopuli) downloads per-language shards.

This adapter wraps that workflow; the actual download is wired in the milestone
that vendors the VoxPopuli downloader. Until then ``catalog``/``fetch`` raise a
clear NotImplementedError rather than fabricating items — honest by design.
"""

from __future__ import annotations

from typing import Iterator, Optional

from ..source import Source, SourceItem
from ...models import License


class VoxPopuliSource(Source):
    name = "voxpopuli"

    # Languages with an unlabeled split in VoxPopuli.
    LANGUAGES = ("en", "de", "fr", "es", "pl", "it", "ro", "hu", "cs", "nl",
                 "fi", "hr", "sk", "sl", "et", "lt")

    def __init__(self, language: str = "en"):
        if language not in self.LANGUAGES:
            raise ValueError(f"voxpopuli has no unlabeled split for {language!r}")
        self.language = language

    def catalog(self, limit: Optional[int] = None, **query) -> Iterator[SourceItem]:
        raise NotImplementedError(
            "Vendor the facebookresearch/voxpopuli downloader, then yield one "
            "SourceItem per audio shard (license=CC0-1.0). Tracked for M-next."
        )

    def fetch(self, item: SourceItem, dest_dir: str) -> str:
        raise NotImplementedError(
            "Delegate to the VoxPopuli downloader for the shard in item.extra."
        )
