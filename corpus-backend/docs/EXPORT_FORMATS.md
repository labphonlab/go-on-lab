# Export Formats

A corpus is only useful if researchers can open it in the tools they already
use. The `corpus.export` package writes three established formats, all with the
**pure standard library** (no extra dependencies, no network), so any annotated
corpus loads into the target tool as-is.

| Format | Tool / use | Module | Output |
|---|---|---|---|
| **Praat TextGrid** | phonetics: inspect/measure boundaries | `export.praat` | one `.TextGrid` per source, tiers: utterance / words / phones |
| **ELAN EAF** | multimodal annotation, conversation | `export.elan` | one `.eaf` per source, one tier per speaker |
| **HF `datasets`** | ML training | `export.hf_datasets` | `metadata.jsonl` + `README.md` (audiofolder layout) |

```python
from corpus.export import export_all
export_all(segments, "out/", media_dir="out/media")   # -> {"praat":N,"elan":N,"hf":M}
```

or `python -m corpus.cli export-demo --out /tmp/exp`.

## Praat TextGrid

Standard long-form TextGrid. Tiers are **gap-filled** (Praat requires a fully
tiled, non-overlapping timeline) and quotes are escaped as `""`. The writer
round-trips with `corpus.alignment.textgrid` (the reader used to ingest MFA
output) — a property covered by tests, which also caught and fixed a `""`
un-escaping bug in the reader.

- `utterance` tier: per-segment transcript text.
- `words` tier: present if WhisperX word timings exist.
- `phones` tier: present if MFA phone alignments are attached.

## ELAN EAF

EAF 3.0 XML: a `TIME_ORDER` pool of millisecond time slots (emitted in
monotonic order, as ELAN expects) and one `TIER` per speaker, so the diarized,
transcribed timeline opens directly. Pass `media_dir` to link each EAF to its
audio file via a `MEDIA_DESCRIPTOR`.

## Hugging Face `datasets`

The `audiofolder` convention: `metadata.jsonl` with a `file_name` column plus
`transcription`, `speaker`, timing, `language`, `asr_confidence`,
`is_machine_label`, `state`, etc. A `README.md` carries the YAML front-matter
`datasets` reads (license, language, configs). Load with:

```python
from datasets import load_dataset
ds = load_dataset("audiofolder", data_dir="out/hf")
```

`is_machine_label` lets consumers separate real-ASR labels from heuristic
placeholders; pair it with the measured WER in the dataset card.

> Note: the exporters write the metadata/annotation files. Audio clips
> themselves are produced by `corpus.annotation.mfa_prep.prepare_mfa_corpus`
> (or your own clip step); `file_name`/`media_dir` point the metadata at them.
