# Auto-Annotation Pipeline — large audio → labelled corpus

> Companion to [`ANNOTATION_PIPELINE.md`](ANNOTATION_PIPELINE.md): that file is
> the stage-by-stage design spec; this one focuses on the production runtimes
> (WhisperX → MFA, modular) and the research legal note (§5).

This subsystem turns **large amounts of unlabelled audio** into a usable speech
corpus by **automatically segmenting and labelling** it (pseudo-labelling). It
is distinct from the M1 prompted-read-speech path: here there is *no script*, so
the labels themselves are machine-generated and must be **quality-gated**.

## 1. The hard truth that drives the design

> Automatic labels are always wrong some of the time. The difference between a
> toy and a research-grade corpus is **confidence scoring + measured error rate
> + selective human verification** — not blind trust in the model.

So the pipeline's job is not only to label, but to **know how much to trust each
label** and route the uncertain fraction to humans. Cost is minimised because
humans only inspect the low-confidence tail, not the whole corpus.

## 2. Stages

```
raw audio ─▶ normalise ─▶ VAD/segment ─▶ diarize ─▶ ASR ─▶ align ─▶ gate ─▶ corpus
 (16k mono)               (utterances)   (who?)    (text)  (word+    (conf-   (+manifest,
                                                            phone)   idence)   error report)
```

| Stage | Interface | Zero-dep baseline | Production plug-in |
|---|---|---|---|
| Segmentation (VAD) | `annotation.base.Segmenter` | `EnergySegmenter` (works) | `SileroSegmenter` |
| Diarization | `annotation.base.Diarizer` | `NullDiarizer` (honest stub) | `PyannoteDiarizer` (pyannote.audio 3.x) |
| Transcription | `annotation.base.Transcriber` | `NullTranscriber` (no fake labels) | `WhisperXTranscriber` |
| Word alignment | (via `WhisperXTranscriber` word timings) | — | **WhisperX** (wav2vec2) |
| Phone alignment | `alignment.ForcedAligner` | `ProportionalAligner` | **MFA** (Montreal Forced Aligner) |
| Quality gate | `annotation.orchestrator.AnnotationPolicy` | implemented | — |

The baselines make the whole pipeline **runnable and testable today** with zero
dependencies; `EnergySegmenter` is genuinely useful, while diarization/ASR baselines
are honest stubs (they do not fabricate speakers or transcripts) so you never
mistake unlabelled output for real labels.

## 3. Two runtimes (recommended for your choice: word + phone, multi-speaker)

The interfaces support two production strategies; both emit the same
`Segment` objects (`annotation.models.Segment`) and manifest:

- **Modular** — Silero VAD + pyannote diarization + faster-whisper + wav2vec2
  alignment, each injected into `AnnotationPipeline` via the stage interfaces
  above. Maximum control per stage.
- **WhisperX → MFA** *(your selection)* — `WhisperXTranscriber` runs Whisper ASR
  + wav2vec2 word alignment (with WhisperX's internal VAD) in one pass, paired
  with `PyannoteDiarizer` for speakers; then **MFA** consumes the transcripts to
  add phone-level boundaries. Fewer moving parts; this is the recommended runtime.

```python
# production (needs: pip install whisperx pyannote.audio; + MFA installed separately)
from corpus.annotation.orchestrator import AnnotationPipeline
from corpus.annotation.plugins import WhisperXTranscriber, PyannoteDiarizer, SileroSegmenter

pipe = AnnotationPipeline(
    segmenter=SileroSegmenter(),
    diarizer=PyannoteDiarizer(hf_token="hf_..."),
    transcriber=WhisperXTranscriber(model_size="large-v3"),
)
segments = pipe.annotate_file("recording.wav", declared_language="ja")
```

## 4. Quality gating (the part that makes it research-grade)

Each segment is scored and routed to one terminal state:

- **ACCEPTED** — high ASR confidence, language matches, duration & SNR in range
  → auto-usable.
- **REVIEW** — soft failure (low confidence, language mismatch, borderline SNR,
  or confidence unknown) → human verification queue.
- **REJECTED** — hard failure (empty transcript, segment too short/long,
  unreadable audio).

Thresholds live in `annotation.orchestrator.AnnotationPolicy` and are
per-campaign.

### Measuring the corpus error rate

Auto-labelling without a measured error rate is not publishable. The workflow,
implemented in `annotation.evaluation`:

1. Draw a random sample of segments — `sample_for_review(segments, n)`.
2. Have a human correct them (transcript + boundaries).
3. Compute WER against the corrections — `measure_wer(corrections, segments)`.
4. Publish these figures in the dataset card — `annotation.manifest.export(...,
   wer=...)` writes the WER into `DATASET_CARD.md`.

`annotation.manifest` records per-state counts and accepted hours per corpus;
mean boundary error (for MFA phone alignments) is the next milestone.

## 5. Legal note (research use)

Found/large-scale audio raises source-rights and personal-data questions even
for non-commercial research. In Japan, the Copyright Act Art. 30-4 (information
analysis) gives wide latitude for analysis-purpose use, but it does **not**
override site terms of service / access controls, nor personal-data and
research-ethics obligations (IRB / 倫理審査, informed consent for identifiable
voices, pseudonymisation). Confirm scope with your ethics committee. *Not legal
advice.*
