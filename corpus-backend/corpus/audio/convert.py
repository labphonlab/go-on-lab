"""Audio format conversion via ffmpeg.

Many easy-to-obtain corpora (LibriVox MP3, web audio) are not PCM-WAV, which the
zero-dependency reader requires. ffmpeg is the de-facto tool; it is invoked as a
subprocess only when conversion runs, and its absence raises a clear error
rather than silently producing nothing.
"""

from __future__ import annotations

import os
import shutil
import subprocess


class FFmpegNotFound(RuntimeError):
    pass


def have_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def to_wav(src_path: str, dest_path: str, *, sample_rate: int = 16000,
           channels: int = 1) -> str:
    """Transcode any ffmpeg-readable audio to mono 16 kHz PCM-WAV.

    Returns ``dest_path``. Raises :class:`FFmpegNotFound` if ffmpeg is missing so
    callers can degrade gracefully instead of mis-reading data.
    """
    if not have_ffmpeg():
        raise FFmpegNotFound(
            "ffmpeg is required to transcode non-PCM-WAV audio (e.g. LibriVox "
            "MP3). Install ffmpeg, or acquire PCM-WAV sources.")
    os.makedirs(os.path.dirname(dest_path) or ".", exist_ok=True)
    cmd = [
        "ffmpeg", "-nostdin", "-y", "-i", src_path,
        "-ac", str(channels), "-ar", str(sample_rate),
        "-c:a", "pcm_s16le", dest_path,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed ({proc.returncode}): "
            f"{proc.stderr.decode('utf-8', 'replace')[-500:]}")
    return dest_path
