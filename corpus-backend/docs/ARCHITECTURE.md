# Go-on Lab Corpus Backend — Architecture

A backend for **automatically collecting research- and commercial-grade speech
corpora**. The design optimises the triangle the project cares about:

> **lowest marginal cost × highest quality × legally sellable**

## 1. Why crowdsourced read speech

We chose *prompted read speech collected directly from consenting contributors*
as the primary acquisition method. The alternatives were rejected for concrete
reasons:

| Method | Cost | Quality | Sellable? | Verdict |
|---|---|---|---|---|
| Web scraping / podcasts | low | variable | **No** — third-party copyright, ToS | rejected |
| Aggregating public corpora | lowest | high | **Usually No** — most are CC-BY-**NC** (non-commercial) | rejected as primary |
| Studio self-recording | high | highest | yes | too expensive to scale |
| **Prompted crowdsourced reading** | **low** | **high** | **yes** | **chosen** |

The decisive properties of prompted read speech:

1. **Transcription is free.** The prompt *is* the ground-truth transcript, so
   the most expensive part of corpus building (manual transcription) disappears.
2. **Licensing is clean.** Consent and a commercial redistribution licence are
   captured at the moment of recording. Provenance is attached to every clip.
3. **Quality is machine-gatable.** Because we know what *should* have been said,
   an ASR pass can score "did they read it correctly?" automatically, and signal
   processing can score the acoustics — minimising human review.
4. **Text rights are avoidable.** Prompts are drawn from public-domain or
   self-authored text, so there is no copyright on the script either.

This is the same recipe behind LibriSpeech and Mozilla Common Voice.

## 2. Pipeline

```
                 ┌──────────────┐
  Prompt sets ──▶│  PromptStore │ (license-tagged, public-domain / authored)
  (PD/authored)  └──────┬───────┘
                        │ prompt_id
                        ▼
  Contributor ──▶ Submission ──▶ ┌───────────────── Orchestrator ─────────────────┐
  (audio + consent)              │ 1. Validate    structural + consent present     │
                                 │ 2. Audio QC    SNR, clipping, silence, duration  │
                                 │ 3. Verify      ASR vs prompt → CER/WER gate       │
                                 │ 4. Align       word/phone forced alignment        │
                                 │ 5. Enrich      tokenise / morphology (JA/EN/…)     │
                                 │ 6. Provenance  consent_id, license, capture meta   │
                                 └───────┬─────────────────────────┬────────────────┘
                                         │ accepted                │ rejected/review
                                         ▼                         ▼
                                   CorpusStore               Review queue
                                   + Manifest + Dataset card
```

Each stage produces a typed result that is recorded on the `CorpusItem`, so the
final artefact is fully **auditable** — a requirement for a sellable dataset.

## 3. Components (this repository)

| Module | Status | Responsibility |
|---|---|---|
| `corpus/models.py` | implemented | Typed domain model + provenance + licensing logic |
| `corpus/audio/wav.py` | implemented | Zero-dependency PCM-WAV reader |
| `corpus/audio/quality.py` | implemented | Acoustic QC metrics + gating |
| `corpus/prompts/store.py` | implemented | License-aware prompt set management |
| `corpus/verification/` | interface + baseline | "Was the prompt read correctly?" (ASR pluggable) |
| `corpus/alignment/` | interface + baseline | Word/phone time alignment (MFA/whisperX pluggable) |
| `corpus/pipeline/` | implemented | Stage orchestration + acceptance gating |
| `corpus/storage/` | implemented | Normalised layout, manifest, dataset card |
| `corpus/cli.py` | implemented | `init / ingest / run / export / validate` |

### Deliberate boundary: core vs. ML plugins

The **core is pure Python standard library (zero dependencies)** so it runs
identically in CI, locked-down containers, and researcher laptops. The two
heavyweight ML capabilities are defined as interfaces with honest baseline
implementations:

- **ASR verification** (`verification.base.PromptVerifier`) — baseline is a
  duration/length plausibility heuristic; swap in `WhisperVerifier` for real CER.
- **Forced alignment** (`alignment.base.ForcedAligner`) — baseline distributes
  prompt tokens proportionally over time; swap in Montreal Forced Aligner or
  whisperX for phone-accurate boundaries.

This keeps the foundation runnable today while making the production-quality
path a drop-in, not a rewrite. See `docs/QUALITY_STANDARDS.md` and
`docs/LICENSING.md`.

## 4. Roadmap

- **M1 (this commit):** typed model, audio QC, prompt store, pipeline,
  manifest/export, CLI, tests — all zero-dependency and green.
- **M2:** `WhisperVerifier` (faster-whisper) + real CER/WER gating; numpy-backed
  QC fast path.
- **M3:** MFA / whisperX forced alignment; phoneme inventories per language.
- **M4:** Collection front-end integrated into Go-on Lab (Next.js) feeding this
  backend over an ingest API; speaker portal + consent capture UI.
- **M5:** Export adapters (Hugging Face `datasets`, Praat TextGrid, ELAN EAF).
