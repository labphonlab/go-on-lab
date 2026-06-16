# Quality Standards & Acceptance Gates

Default acceptance thresholds for research-/commercial-grade speech. All values
live in `corpus.audio.quality.QCThresholds` and
`corpus.pipeline.orchestrator.AcceptancePolicy`, and can be overridden per
collection campaign.

## Acoustic (signal) gates

| Metric | Default gate | Rationale |
|---|---|---|
| Sample rate | ≥ 16 000 Hz | 16 kHz min for ASR; 44.1/48 kHz for phonetics |
| Bit depth | ≥ 16 bit | research-grade dynamic range |
| Channels | mono preferred | per-speaker isolation |
| Duration | 0.4 s – 30 s | reject empty / runaway clips |
| Peak level | ≤ 0.99 (no clip) | clipping destroys spectra |
| Clipping ratio | ≤ 0.1 % of samples | tolerate isolated transients only |
| RMS level | −36 to −12 dBFS | usable headroom, not too quiet |
| Estimated SNR | ≥ 20 dB | clean enough for acoustic analysis |
| Silence ratio | ≤ 60 % | mostly speech, not dead air |
| DC offset | ≤ 0.02 | detects capture faults |

The SNR figure is a **heuristic** (quietest-window noise floor vs. speech RMS),
adequate for gating; for phonetic precision swap in a VAD-based estimator.

## Content (linguistic) gates

| Metric | Default gate | Provided by |
|---|---|---|
| Read-correctly score | CER ≤ 0.15 vs. prompt | `verification` (ASR) |
| Language match | detected == declared | `verification` |

The baseline verifier uses a duration/length plausibility check and is marked
`is_heuristic=True`; production uses an ASR-derived CER/WER. Items that pass
acoustics but fail content go to a **review queue** rather than outright reject.

## Decision outcomes

Each item ends in exactly one state:

- `ACCEPTED` — passes all hard gates → eligible for the corpus (and for
  commercial export if `is_sellable()`).
- `REVIEW` — soft failure (e.g. content gate, borderline SNR) → human review.
- `REJECTED` — hard failure (corrupt audio, missing consent, severe clipping).

Every gate result is stored on the item so decisions are reproducible.
