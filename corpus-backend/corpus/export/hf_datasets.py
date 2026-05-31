"""Export to a Hugging Face ``datasets``-loadable layout (audiofolder style).

We emit ``metadata.jsonl`` in the conventional schema used by the `audiofolder`
loader: one row per segment with a ``file_name`` pointing at the clip plus
columns for transcript, speaker, timing, language and quality. A README with the
YAML front-matter `datasets` reads is written too. No third-party dependency:
the files are exactly what ``datasets.load_dataset("audiofolder", data_dir=...)``
expects, so the corpus loads with one call where `datasets` is installed.
"""

from __future__ import annotations

import json
import os

from ..annotation.models import Segment
from ..models import ItemState


def _row(seg: Segment, file_name: str) -> dict:
    tr = seg.transcript
    return {
        "file_name": file_name,
        "segment_id": seg.segment_id,
        "source_id": seg.source_id,
        "speaker": seg.speaker,
        "start_s": round(seg.start_s, 4),
        "end_s": round(seg.end_s, 4),
        "duration_s": round(seg.duration_s, 4),
        "transcription": (tr.text if tr else None),
        "language": (tr.language if tr else None),
        "asr_confidence": (tr.confidence if tr else None),
        "is_machine_label": (bool(tr and not tr.is_heuristic) if tr else False),
        "n_words": (len(tr.words) if tr else 0),
        "n_phones": len(seg.phones),
        "state": seg.state.value,
    }


_README = """---
license: cc0-1.0
task_categories:
- automatic-speech-recognition
language:
{languages}
pretty_name: Go-on Lab Corpus
tags:
- speech
- auto-labeled
configs:
- config_name: default
  data_files: metadata.jsonl
---

# Go-on Lab Corpus (Hugging Face layout)

Load with:

```python
from datasets import load_dataset
ds = load_dataset("audiofolder", data_dir="<this directory>")
```

Each row is a segment with `transcription`, `speaker`, timing and quality
columns. `is_machine_label` distinguishes real-ASR labels from heuristic
placeholders. See the project's dataset card for the measured error rate.
"""


def export_hf(segments: list[Segment], out_dir: str,
              accepted_only: bool = True,
              clip_namer=None) -> int:
    """Write metadata.jsonl + README.md for the audiofolder loader.

    ``clip_namer(seg) -> relative file_name`` lets the caller point rows at clip
    files it has written; defaults to ``audio/{safe_segment_id}.wav``. Returns
    the number of rows written.
    """
    os.makedirs(out_dir, exist_ok=True)
    sel = ([s for s in segments if s.state == ItemState.ACCEPTED]
           if accepted_only else list(segments))

    def default_namer(seg: Segment) -> str:
        safe = seg.segment_id.replace("/", "__").replace("#", "_")
        return f"audio/{safe}.wav"

    namer = clip_namer or default_namer
    langs = sorted({s.transcript.language for s in sel
                    if s.transcript and s.transcript.language})

    with open(os.path.join(out_dir, "metadata.jsonl"), "w", encoding="utf-8") as fh:
        for seg in sel:
            fh.write(json.dumps(_row(seg, namer(seg)), ensure_ascii=False) + "\n")

    yaml_langs = "\n".join(f"- {l}" for l in langs) if langs else "- und"
    with open(os.path.join(out_dir, "README.md"), "w", encoding="utf-8") as fh:
        fh.write(_README.format(languages=yaml_langs))
    return len(sel)
