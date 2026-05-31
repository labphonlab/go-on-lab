# M3 — Real ML integration (WhisperX → MFA)

M3 wires the production labeling stack chosen for this build: **WhisperX** for
word-level transcription + diarization, then **MFA** for phone boundaries. The
design keeps the heavy model I/O thin and isolates the *valuable* logic — mapping
model output to gated, auditable segments — into pure functions tested offline.

## Flow

```
audio ─▶ WhisperXPipeline.process()                 (whisperx + pyannote, GPU)
            │  VAD + Whisper ASR + wav2vec2 word align + diarization, 1 pass
            ▼
        segments_from_whisperx(result)              (PURE — fully unit-tested)
            │  -> gated Segment objects (confidence, language, duration, snr)
            ▼
        prepare_mfa_corpus(wav, segments)           (PURE — writes wav+txt pairs)
            │
            ▼
        run_mfa_align(corpus, dict, acoustic, out)  (mfa subprocess)
            │  -> TextGrid per utterance
            ▼
        attach_phones(segments, textgrid_dir)       (PURE — TextGrid parser)
            │  -> phone-level alignment on each segment
            ▼
        manifest + dataset card (+ measured WER)
```

The two `WhisperXPipeline` / `run_mfa_align` steps are the only ones needing
GPUs, network or external binaries. Everything between them is standard-library
and covered by `tests/test_whisperx_mapping.py` and `tests/test_mfa.py`.

## Why this split

Auto-labeling quality lives in the *mapping and gating*, not in calling the
model. By making `segments_from_whisperx`, the TextGrid parser, `attach_phones`
and `prepare_mfa_corpus` pure and deterministic, the part that decides
accept/review/reject and that interprets phone boundaries is testable, reviewable
and reproducible — even on a machine with no ML stack. The model wrappers are
deliberately thin and import their deps lazily.

## Install (where GPUs/network are available)

```bash
pip install whisperx                      # ASR + word align (+ pyannote diar)
# MFA via conda (separate ecosystem):
conda install -c conda-forge montreal-forced-aligner
mfa model download acoustic   english_mfa
mfa model download dictionary english_mfa
```

## Use

```python
from corpus.annotation.whisperx_pipeline import WhisperXPipeline
from corpus.annotation.mfa_prep import prepare_mfa_corpus
from corpus.alignment.mfa import run_mfa_align, attach_phones
from corpus.audio.wav import read_wav

pipe = WhisperXPipeline(model_size="large-v3", device="cuda", diarize=True,
                        hf_token="hf_...")
segments = pipe.process("meeting.wav", source_id="meeting-001")

wav = read_wav("meeting.wav")            # 16 kHz mono PCM (transcode first)
prepare_mfa_corpus(wav, segments, "mfa_in/")
run_mfa_align("mfa_in/", "english_mfa", "english_mfa", "mfa_out/")
attach_phones(segments, "mfa_out/")      # phones now on each segment
```

Offline, the mapping + gating is demonstrable with:

```bash
python -m corpus.cli whisperx-demo
```

which feeds a canned WhisperX-shaped result through the exact same
`segments_from_whisperx` path used in production.

## Honesty notes

- The model wrappers raise on missing deps/binaries (`import whisperx`,
  `MFANotFound`, `FFmpegNotFound`) rather than fabricating labels or alignments.
- WhisperX output is marked `is_heuristic=False` (real ASR); the stdlib baseline
  remains `is_heuristic=True` and routes to review. Consumers can always tell
  machine-guessed-but-unverified labels from real-but-still-to-be-WER-measured
  ones.
- This environment blocks outbound network and ships no GPU/ffmpeg/MFA, so the
  two model steps were not executed here; their I/O contract is exercised by the
  offline mapping tests and the canned-result CLI demo.
