# Annotation Pipeline — automatic segmentation & labeling

This pipeline turns **raw, long, multi-speaker audio** into a research-grade
corpus *without a script*. Because there is no prompt to compare against, the
labels themselves are machine-generated (pseudo-labeling), so **confidence
scoring and error-rate measurement are the core of quality**, not an add-on.

This is distinct from the M1 read-speech pipeline (`corpus/pipeline/`), where the
prompt *is* the ground truth. Here, ground truth is estimated and must be gated.

## Stages

```
raw audio (long, multi-speaker)
   │
   ▼ 1. normalise        16 kHz mono, level-normalise            (ffmpeg)
   ▼ 2. VAD segmentation  cut into speech regions                 (Silero / energy baseline)
   ▼ 3. diarization       "who spoke when" -> speaker turns       (pyannote / null baseline)
   ▼ 4. intersect         speaker-homogeneous speech segments     (interval intersection)
   ▼ 5. transcription     ASR label + word timings + language id  (WhisperX / null baseline)
   ▼ 6. forced alignment  word -> phone boundaries                (MFA, optional)
   ▼ 7. confidence gate   accept / review / reject per segment    (this package)
   │
   ▼ AnnotatedCorpus + manifest + measured error rate
```

## The quality principle (read this)

> **Automatic labels are always wrong some of the time. The line between a toy
> and a research corpus is: confidence scores + a measured error rate + human
> verification of the low-confidence tail.**

Cost is minimised not by skipping verification but by *targeting* it:

1. Score every segment: ASR confidence, alignment score, language-id match,
   per-segment SNR, duration plausibility.
2. **Auto-accept high-confidence** segments; route only the **low-confidence
   tail** to human review.
3. Hand-verify a **random sample** and publish the corpus-level WER / boundary
   error so downstream users know what they are getting.

A pile of un-verified ASR output is not a research corpus. The gate + sampled
verification is what makes it one.

## Recommended stack (2026)

| Stage | Tool | Notes |
|---|---|---|
| Segmentation | Silero VAD / pyannote VAD | energy baseline ships here, zero-dep |
| Diarization | pyannote.audio 3.x | needed for multi-speaker; null baseline here |
| ASR + word align | **WhisperX** | one pass: VAD+Whisper+wav2vec2 word timings + lang id |
| Phone align | **Montreal Forced Aligner** | feed WhisperX transcript; JA/EN acoustic models |

The shortest real path is **WhisperX for words, then MFA for phones** — exactly
the granularity chosen for this build.

## Plugin boundary (same philosophy as M1)

Core baselines are **zero-dependency** so the pipeline is runnable and testable
today:

- `EnergySegmenter` — energy/silence VAD (real: `SileroSegmenter`).
- `NullDiarizer` — labels one speaker, `is_estimate=True` (real: `PyannoteDiarizer`).
- `NullTranscriber` — produces segments with **no fabricated transcript**,
  `is_heuristic=True` (real: `WhisperXTranscriber`).
- Phone alignment via the existing `alignment` interface (real: `MFAAligner`).

Swapping in the real components is a constructor change, not a rewrite. Segments
the baseline cannot verify (no ASR) are routed to **review**, never silently
accepted — the honest behaviour for a research tool.

## Per-segment decision

Each segment ends in `accepted` / `review` / `rejected` using the same
`GateResult` machinery as M1:

| Gate | Default | Severity |
|---|---|---|
| duration | 0.3–30 s | hard |
| per-segment SNR | ≥ 15 dB | soft |
| ASR confidence | ≥ 0.6 (if known) | soft |
| language match | detected == declared (if declared) | soft |
| transcript present | required for accept | soft → review |

Every gate result and score is stored on the segment, so the corpus is auditable
and the error-rate measurement is reproducible.
