"""LibriVox source: public-domain audiobooks (Tier-1 target).

LibriVox recordings are **public domain**, and most of the catalog has never
been time-aligned or phonetically analysed — exactly the "easy to obtain,
under-labeled" niche. Text comes from Project Gutenberg (also PD).

The adapter is built around an injectable :data:`~corpus.acquisition.net.Opener`
so it is fully testable offline: production uses stdlib urllib, tests inject a
fake that serves canned API JSON and a canned zip. The LibriVox JSON API shape
is encapsulated here so the rest of the system stays source-agnostic.

API: https://librivox.org/api/info  (feed/audiobooks, JSON)

Note: LibriVox distributes MP3. ``fetch`` downloads the per-book zip, extracts
the audio tracks, and (if ffmpeg is available) transcodes them to PCM-WAV so the
zero-dependency reader and the QC/annotation pipeline can consume them.
"""

from __future__ import annotations

import io
import os
import zipfile
from typing import Iterator, Optional
from urllib.parse import urlencode

from ..source import Source, SourceItem
from ..net import Opener, urlopen_bytes, get_json
from ...models import License

_API = "https://librivox.org/api/feed/audiobooks"
_AUDIO_EXTS = (".mp3", ".ogg", ".flac", ".m4a", ".wav")


class LibriVoxSource(Source):
    name = "librivox"

    def __init__(self, language: str = "english", opener: Opener | None = None,
                 transcode: bool = True, sample_rate: int = 16000):
        self.language = language
        self._opener: Opener = opener or urlopen_bytes
        self.transcode = transcode
        self.sample_rate = sample_rate

    # -- catalog ------------------------------------------------------------

    def catalog(self, limit: Optional[int] = None, **query) -> Iterator[SourceItem]:
        params = {"format": "json", "limit": limit or 50,
                  "extended": 1, "coverage": "complete"}
        if self.language:
            params["language"] = self.language
        params.update(query)
        url = f"{_API}?{urlencode(params)}"
        data = get_json(self._opener, url)
        for book in data.get("books", []):
            zip_url = book.get("url_zip_file")
            if not zip_url:
                continue
            yield SourceItem(
                item_id=str(book.get("id")),
                source=self.name, audio_url=zip_url,
                language=_bcp47(book.get("language") or self.language),
                license=License.CC0_1_0,  # PD; treated as CC0-equivalent here
                title=book.get("title"),
                attribution=f"LibriVox / {book.get('title')} (public domain)",
                transcript_url=book.get("url_text_source"),
                duration_s=_to_seconds(book.get("totaltimesecs")),
                extra={"gutenberg": book.get("url_text_source")},
            )

    # -- fetch --------------------------------------------------------------

    def fetch(self, item: SourceItem, dest_dir: str) -> str:
        """Download the book zip, extract audio tracks, optionally transcode.

        Returns the directory containing the (transcoded) tracks. The registry
        hashes that path; see :meth:`fetch_tracks` for the track list.
        """
        out_dir = self._extract(item, dest_dir)
        tracks = sorted(
            os.path.join(out_dir, f) for f in os.listdir(out_dir)
            if f.lower().endswith(_AUDIO_EXTS))
        if self.transcode:
            tracks = self._transcode_all(tracks, out_dir)
        # Return the first track as the canonical path for the registry; the
        # full list is available via fetch_tracks for multi-track ingestion.
        return tracks[0] if tracks else out_dir

    def fetch_tracks(self, item: SourceItem, dest_dir: str) -> list[str]:
        """Like :meth:`fetch` but returns every (transcoded) track path."""
        out_dir = self._extract(item, dest_dir)
        tracks = sorted(
            os.path.join(out_dir, f) for f in os.listdir(out_dir)
            if f.lower().endswith(_AUDIO_EXTS))
        return self._transcode_all(tracks, out_dir) if self.transcode else tracks

    # -- internals ----------------------------------------------------------

    def _extract(self, item: SourceItem, dest_dir: str) -> str:
        out_dir = os.path.join(dest_dir, f"librivox_{item.item_id}")
        os.makedirs(out_dir, exist_ok=True)
        raw = self._opener(item.audio_url)
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            for info in zf.infolist():
                name = os.path.basename(info.filename)
                if not name or not name.lower().endswith(_AUDIO_EXTS):
                    continue
                # Flatten into out_dir; guard against path traversal.
                target = os.path.join(out_dir, name)
                with zf.open(info) as src, open(target, "wb") as dst:
                    dst.write(src.read())
        return out_dir

    def _transcode_all(self, tracks: list[str], out_dir: str) -> list[str]:
        from ...audio.convert import to_wav, have_ffmpeg, FFmpegNotFound

        if not have_ffmpeg():
            # Honest: keep originals, signal that they still need transcoding.
            raise FFmpegNotFound(
                "LibriVox tracks are MP3; install ffmpeg to transcode to WAV, "
                "or construct LibriVoxSource(transcode=False) to keep originals.")
        out: list[str] = []
        for t in tracks:
            if t.lower().endswith(".wav"):
                out.append(t)
                continue
            wav = os.path.splitext(t)[0] + ".wav"
            to_wav(t, wav, sample_rate=self.sample_rate, channels=1)
            out.append(wav)
        return out


def _to_seconds(v) -> Optional[float]:
    """LibriVox totaltimesecs is sometimes a string of seconds."""
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _bcp47(librivox_lang: str) -> str:
    """Map LibriVox language names to BCP-47 codes (best effort)."""
    table = {
        "english": "en", "german": "de", "french": "fr", "spanish": "es",
        "italian": "it", "dutch": "nl", "japanese": "ja", "russian": "ru",
        "portuguese": "pt", "chinese": "zh", "latin": "la",
    }
    if not librivox_lang:
        return "und"
    return table.get(librivox_lang.strip().lower(), librivox_lang)
