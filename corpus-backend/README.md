# Go-on Lab — Corpus Backend

Independent backend for **automatically collecting research- and
commercial-grade speech corpora**, optimised for *lowest cost × highest quality
× legally sellable* via **prompted, consented, crowdsourced read speech**.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design and the
rationale for the acquisition method, [`docs/LICENSING.md`](docs/LICENSING.md)
for the consent/sellability model, and
[`docs/QUALITY_STANDARDS.md`](docs/QUALITY_STANDARDS.md) for the acceptance gates.

## Two pipelines

1. **Read-speech** (`corpus/pipeline/`) — prompted, consented recordings where
   the prompt *is* the ground-truth transcript. Best for sellable corpora.
2. **Annotation / pseudo-labeling** (`corpus/annotation/`) — turn *raw,
   long, multi-speaker* audio into a corpus with **automatic segmentation and
   labeling** (VAD → diarization → ASR → forced alignment), gated by confidence
   and a measured error rate. See
   [`docs/ANNOTATION_PIPELINE.md`](docs/ANNOTATION_PIPELINE.md). Best for
   research use over existing audio.

## Design highlights

- **Zero-dependency core.** Models, audio QC, prompt store, pipeline and export
  use only the Python standard library, so it runs identically in CI, locked
  containers and on laptops.
- **Pluggable ML.** ASR-based read-correctness verification and forced alignment
  are interfaces with honest baselines; swap in faster-whisper / MFA for
  production without touching the pipeline.
- **Auditable & sellable.** Every accepted clip carries consent, licence and
  provenance; `CorpusItem.is_sellable()` enforces the chain of rights.

## Quick start

```bash
cd corpus-backend

# End-to-end demo: synthesise clips, run the pipeline, export a manifest.
python -m corpus.cli demo --out /tmp/goon_demo
cat /tmp/goon_demo/DATASET_CARD.md

# Annotation pipeline: auto segment + label raw audio (pseudo-labeling).
python -m corpus.cli annotate-demo --out /tmp/ann_demo
python -m corpus.cli annotate --audio long_recording.wav --out ./ann_out

# Acquisition: ingest easy-to-obtain, under-labeled audio (provenance + dedup),
# then run the full acquire -> annotate flow end to end.
python -m corpus.cli acquire --dir ./my_audio --store ./store --language ja
python -m corpus.cli acquire-demo --out /tmp/acq_demo

# LibriVox: acquire public-domain audiobooks (needs outbound network + ffmpeg).
# Multi-track books are transcoded to 16 kHz mono WAV and dedup'd by content hash.
python -m corpus.cli librivox --language english --limit 3 --store ./lv_store

# Inspect a prompt set.
python -m corpus.cli prompts --file examples/prompts_ja.jsonl

# Process a real recording (16-bit+ PCM WAV).
python -m corpus.cli run --audio clip.wav \
  --prompt-file examples/prompts_en.jsonl --prompt-id en-0001 \
  --speaker spk001 --out ./out

# Tests (zero dependencies; pytest optional — see below).
python -m pytest -q          # if pytest is installed
python tests/run_tests.py    # stdlib-only fallback runner
```

## Layout

```
corpus/
  models.py            typed domain model + provenance + sellability rule
  audio/wav.py         zero-dep PCM-WAV reader
  audio/quality.py     acoustic QC metrics + gates
  audio/synth.py       WAV signal generator (demo/tests)
  acquisition/         acquire under-labeled audio: Source interface, registry
                       (provenance + content-hash dedup + manifest), adapters
                       (local_dir offline; librivox/voxpopuli/diet_jp lazy net)
  prompts/store.py     license-aware prompt sets (JSONL)
  verification/        "read correctly?" — base + heuristic + ASR (pluggable)
  alignment/           forced alignment — base + proportional baseline
  pipeline/            read-speech orchestration + acceptance gating
  annotation/          auto segment+label: VAD/diarize/ASR baselines + plugins,
                       confidence gating, WER measurement, manifest
  storage/manifest.py  manifest, CSV, dataset card, commercial export
  cli.py               prompts / run / demo / annotate / acquire (+ demos)
docs/                  ARCHITECTURE, LICENSING, QUALITY_STANDARDS,
                       ANNOTATION_PIPELINE, AUTO_ANNOTATION, SOURCE_CATALOG
examples/              prompt sets (en, ja)
tests/                 pytest + stdlib fallback runner
```
