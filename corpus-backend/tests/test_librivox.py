"""Offline tests for the LibriVox adapter.

The environment blocks outbound network, so we inject a fake Opener that serves
canned API JSON and a canned zip. This verifies all adapter logic (catalog
parsing, zip download/extract, track listing) without the network — exactly what
will run for real where egress is allowed.
"""

import io
import json
import os
import sys
import tempfile
import zipfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.audio.synth import write_tone_wav
from corpus.acquisition.adapters.librivox import LibriVoxSource, _bcp47
from corpus.acquisition.registry import AcquisitionRegistry
from corpus.models import License


def _canned_api_json(zip_url):
    return json.dumps({"books": [
        {"id": 101, "title": "Aesop's Fables", "language": "english",
         "totaltimesecs": "1234", "url_zip_file": zip_url,
         "url_text_source": "https://gutenberg.org/ebooks/11"},
        {"id": 102, "title": "No Zip Book", "language": "english"},  # skipped
    ]}).encode("utf-8")


def _canned_zip_with_wav():
    """A zip containing two PCM-WAV 'tracks' (so no ffmpeg is needed)."""
    d = tempfile.mkdtemp()
    w1 = os.path.join(d, "track1.wav")
    w2 = os.path.join(d, "track2.wav")
    write_tone_wav(w1, duration_s=1.0, amplitude=0.3)
    write_tone_wav(w2, duration_s=1.2, amplitude=0.3, freq=220.0)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.write(w1, "Aesop/track1.wav")
        zf.write(w2, "Aesop/track2.wav")
        zf.writestr("Aesop/readme.txt", "not audio")  # ignored
    return buf.getvalue()


def _make_opener(zip_url):
    api = _canned_api_json(zip_url)
    zip_bytes = _canned_zip_with_wav()

    def opener(url):
        if url == zip_url:
            return zip_bytes
        return api  # any API URL returns the canned catalog
    return opener


def test_catalog_parses_and_skips_missing_zip():
    zip_url = "https://example.org/aesop.zip"
    src = LibriVoxSource(opener=_make_opener(zip_url))
    items = list(src.catalog(limit=10))
    assert len(items) == 1                      # the no-zip book is skipped
    it = items[0]
    assert it.item_id == "101"
    assert it.language == "en"                  # mapped from "english"
    assert it.license == License.CC0_1_0
    assert it.audio_url == zip_url
    assert "public domain" in it.attribution
    assert it.duration_s == 1234.0


def test_fetch_tracks_downloads_and_extracts_wav():
    zip_url = "https://example.org/aesop.zip"
    # transcode=False so the WAV tracks pass through without ffmpeg
    src = LibriVoxSource(opener=_make_opener(zip_url), transcode=False)
    item = next(src.catalog())
    dest = tempfile.mkdtemp()
    tracks = src.fetch_tracks(item, dest)
    assert len(tracks) == 2
    assert all(t.endswith(".wav") for t in tracks)
    assert all(os.path.getsize(t) > 0 for t in tracks)


def test_fetch_returns_canonical_track_for_registry():
    zip_url = "https://example.org/aesop.zip"
    src = LibriVoxSource(opener=_make_opener(zip_url), transcode=False)
    item = next(src.catalog())
    dest = tempfile.mkdtemp()
    path = src.fetch(item, dest)
    assert path.endswith(".wav")
    assert os.path.exists(path)


def test_acquire_via_registry_records_pd_license():
    zip_url = "https://example.org/aesop.zip"
    src = LibriVoxSource(opener=_make_opener(zip_url), transcode=False)
    store = tempfile.mkdtemp()
    reg = AcquisitionRegistry(store)
    item = next(src.catalog())
    acquired = reg.acquire(src, item)
    assert acquired is not None
    assert acquired.license == "CC0-1.0"
    assert acquired.source == "librivox"
    assert len(acquired.sha256) == 64


def test_acquire_tracks_registers_each_track_separately():
    zip_url = "https://example.org/aesop.zip"
    src = LibriVoxSource(opener=_make_opener(zip_url), transcode=False)
    store = tempfile.mkdtemp()
    reg = AcquisitionRegistry(store)
    item = next(src.catalog())
    tracks = reg.acquire_tracks(src, item)
    assert len(tracks) == 2                       # both tracks registered
    ids = {t.item_id for t in tracks}
    assert ids == {"101#000", "101#001"}
    # manifest has one line per track
    lines = open(reg.manifest_path, encoding="utf-8").read().strip().splitlines()
    assert len(lines) == 2


def test_bcp47_mapping():
    assert _bcp47("English") == "en"
    assert _bcp47("japanese") == "ja"
    assert _bcp47("") == "und"
    assert _bcp47("Klingon") == "Klingon"  # unknown passes through
