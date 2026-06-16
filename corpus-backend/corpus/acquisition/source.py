"""Source interface for acquiring easy-to-obtain, under-labeled audio.

A :class:`Source` is an adapter over an external corpus/archive. It lists items
(`catalog`) with their licence and attribution, and downloads one (`fetch`). The
registry layers provenance, dedup and a manifest on top. Adapters that hit the
network import their HTTP/SDK deps lazily so the core stays zero-dependency.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterator, Optional

from ..models import License


@dataclass
class SourceItem:
    """One acquirable unit (an audiobook chapter, a session, a clip)."""

    item_id: str            # unique within the source
    source: str             # source name, e.g. "librivox"
    audio_url: str          # where to fetch the audio (or local path)
    language: str           # BCP-47
    license: License
    title: Optional[str] = None
    attribution: Optional[str] = None   # required for CC-BY; good practice always
    transcript: Optional[str] = None    # known text, if the source provides it
    transcript_url: Optional[str] = None
    duration_s: Optional[float] = None
    extra: dict = field(default_factory=dict)


class Source:
    """Strategy interface implemented by each adapter."""

    name: str = "source"

    def catalog(self, limit: Optional[int] = None, **query) -> Iterator[SourceItem]:
        """Yield available items (metadata only; no audio downloaded)."""
        raise NotImplementedError

    def fetch(self, item: SourceItem, dest_dir: str) -> str:
        """Download ``item``'s audio into ``dest_dir``; return the local path."""
        raise NotImplementedError
