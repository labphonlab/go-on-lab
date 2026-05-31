# Go-on Lab — Corpus Backend

Independent backend for **automatically collecting research- and
commercial-grade speech corpora**, optimised for *lowest cost × highest quality
× legally sellable* via **prompted, consented, crowdsourced read speech**.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design and the
rationale for the acquisition method, [`docs/LICENSING.md`](docs/LICENSING.md)
for the consent/sellability model, and
[`docs/QUALITY_STANDARDS.md`](docs/QUALITY_STANDARDS.md) for the acceptance gates.

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
  prompts/store.py     license-aware prompt sets (JSONL)
  verification/        "read correctly?" — base + heuristic + ASR (pluggable)
  alignment/           forced alignment — base + proportional baseline
  pipeline/            stage orchestration + acceptance gating
  storage/manifest.py  manifest, CSV, dataset card, commercial export
  cli.py               prompts / run / demo
docs/                  ARCHITECTURE, LICENSING, QUALITY_STANDARDS
examples/              prompt sets (en, ja)
tests/                 pytest + stdlib fallback runner
```
