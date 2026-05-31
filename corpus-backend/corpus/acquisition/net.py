"""Tiny HTTP helper shared by network source adapters.

The single ``Opener`` indirection lets every adapter be tested fully offline:
production uses :func:`urlopen_bytes` (stdlib urllib), tests inject a fake that
serves canned bytes. No third-party HTTP dependency.
"""

from __future__ import annotations

import json
from typing import Callable
from urllib.request import urlopen, Request

# An Opener takes a URL and returns the raw response bytes.
Opener = Callable[[str], bytes]

_UA = {"User-Agent": "go-on-lab-corpus/0.1 (research; +https://go-on-lab)"}


def urlopen_bytes(url: str, timeout: float = 30.0) -> bytes:
    """Default production opener: GET ``url`` and return the body bytes."""
    req = Request(url, headers=_UA)
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def get_json(opener: Opener, url: str) -> dict:
    return json.loads(opener(url).decode("utf-8"))
