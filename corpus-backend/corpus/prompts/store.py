"""License-aware prompt set management.

Prompts are loaded from JSONL files (one prompt per line). Each prompt carries
its own text licence so the corpus can prove that the *script* is clear for
redistribution (public-domain or authored), independent of speaker consent.
"""

from __future__ import annotations

import json
from typing import Iterable, Iterator, Optional

from ..models import License, Prompt


class PromptStore:
    def __init__(self) -> None:
        self._prompts: dict[str, Prompt] = {}

    def add(self, prompt: Prompt) -> None:
        if prompt.prompt_id in self._prompts:
            raise ValueError(f"duplicate prompt_id: {prompt.prompt_id}")
        self._prompts[prompt.prompt_id] = prompt

    def get(self, prompt_id: str) -> Prompt:
        return self._prompts[prompt_id]

    def __len__(self) -> int:
        return len(self._prompts)

    def __iter__(self) -> Iterator[Prompt]:
        return iter(self._prompts.values())

    def by_language(self, language: str) -> list[Prompt]:
        return [p for p in self._prompts.values() if p.language == language]

    @classmethod
    def from_jsonl(cls, path: str) -> "PromptStore":
        store = cls()
        with open(path, "r", encoding="utf-8") as fh:
            for line_no, line in enumerate(fh, 1):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                try:
                    rec = json.loads(line)
                    store.add(Prompt(
                        prompt_id=rec["prompt_id"],
                        language=rec["language"],
                        text=rec["text"],
                        text_license=License(rec.get("text_license", "CC0-1.0")),
                        domain=rec.get("domain"),
                    ))
                except (KeyError, ValueError) as exc:
                    raise ValueError(f"{path}:{line_no}: invalid prompt: {exc}")
        return store

    def extend_from_jsonl(self, path: str) -> None:
        other = PromptStore.from_jsonl(path)
        for p in other:
            self.add(p)
