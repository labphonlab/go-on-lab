"""VoxPopuli source: CC0 European-Parliament speech, large unlabeled subset.

VoxPopuli ships ~100k hours of **unlabeled** multilingual audio under CC0 — a
strong "easy to obtain, under-labeled" target for adding our own labels. The
data is distributed as per-language, per-year tar archives on a public mirror;
the official downloader (facebookresearch/voxpopuli) just fetches those URLs.

This adapter encapsulates that URL scheme behind the injectable ``Opener`` used
by the other network adapters, so it is fully testable offline. ``catalog``
enumerates the (year) shards for a language; ``fetch`` downloads a shard tar and
extracts its audio. Transcoding to PCM-WAV (the archives are OGG/wav) reuses the
shared ffmpeg helper.

CC0 means no attribution is legally required, but we still record provenance.
"""

from __future__ import annotations

import io
import os
import tarfile
from typing import Iterator, Optional

from ..source import Source, SourceItem
from ..net import Opener, urlopen_bytes
from ...models import License

# Public mirror pattern used by the official downloader (unlabeled audio).
_BASE = "https://dl.fbaipublicfiles.com/voxpopuli/audios"
_AUDIO_EXTS = (".ogg", ".wav", ".flac", ".mp3", ".m4a")


class VoxPopuliSource(Source):
    name = "voxpopuli"

    # Languages with an unlabeled split, and the years available for each.
    LANGUAGES = ("en", "de", "fr", "es", "pl", "it", "ro", "hu", "cs", "nl",
                 "fi", "hr", "sk", "sl", "et", "lt")
    YEARS = tuple(range(2009, 2021))

    def __init__(self, language: str = "en", opener: Opener | None = None,
                 transcode: bool = True, sample_rate: int = 16000):
        if language not in self.LANGUAGES:
            raise ValueError(f"voxpopuli has no unlabeled split for {language!r}")
        self.language = language
        self._opener: Opener = opener or urlopen_bytes
        self.transcode = transcode
        self.sample_rate = sample_rate

    def shard_url(self, year: int) -> str:
        return f"{_BASE}/{self.language}_{year}.tar"

    def catalog(self, limit: Optional[int] = None, years=None,
                **query) -> Iterator[SourceItem]:
        """Yield one SourceItem per (language, year) shard."""
        years = years or self.YEARS
        n = 0
        for year in years:
            yield SourceItem(
                item_id=f"{self.language}_{year}",
                source=self.name, audio_url=self.shard_url(year),
                language=self.language, license=License.CC0_1_0,
                title=f"VoxPopuli {self.language} {year} (unlabeled)",
                attribution="VoxPopuli (CC0) / European Parliament",
                extra={"year": year},
            )
            n += 1
            if limit is not None and n >= limit:
                return

    def fetch(self, item: SourceItem, dest_dir: str) -> str:
        return self.fetch_tracks(item, dest_dir)[0]

    def fetch_tracks(self, item: SourceItem, dest_dir: str) -> list[str]:
        """Download a shard tar, extract audio tracks, optionally transcode."""
        out_dir = os.path.join(dest_dir, f"voxpopuli_{item.item_id}")
        os.makedirs(out_dir, exist_ok=True)
        raw = self._opener(item.audio_url)
        tracks: list[str] = []
        with tarfile.open(fileobj=io.BytesIO(raw)) as tf:
            for member in tf.getmembers():
                name = os.path.basename(member.name)
                if not member.isfile() or not name.lower().endswith(_AUDIO_EXTS):
                    continue
                f = tf.extractfile(member)
                if f is None:
                    continue
                target = os.path.join(out_dir, name)
                with open(target, "wb") as dst:
                    dst.write(f.read())
                tracks.append(target)
        tracks.sort()
        return self._transcode_all(tracks, out_dir) if self.transcode else tracks

    def _transcode_all(self, tracks: list[str], out_dir: str) -> list[str]:
        from ...audio.convert import to_wav, have_ffmpeg, FFmpegNotFound
        if not have_ffmpeg():
            raise FFmpegNotFound(
                "VoxPopuli archives are OGG; install ffmpeg to transcode to WAV, "
                "or construct VoxPopuliSource(transcode=False) to keep originals.")
        out = []
        for t in tracks:
            if t.lower().endswith(".wav"):
                out.append(t)
                continue
            wav = os.path.splitext(t)[0] + ".wav"
            to_wav(t, wav, sample_rate=self.sample_rate, channels=1)
            out.append(wav)
        return out
