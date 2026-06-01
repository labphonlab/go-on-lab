# Vowel Formant (F1/F2) Analysis — the gold standard of phonetic validation

If a corpus's vowels land in the right places in F1/F2 space, the audio, the
vowel labels and the alignment are all *jointly* plausible. If the vowel space is
collapsed or scrambled, something upstream is broken. This is a far deeper check
than phone duration (`docs/CORPUS_PROFILE.md`) — it validates the actual acoustic
content against linguistic expectation.

```bash
corpus vowels --audio source.wav --segments segments.jsonl --language en
corpus vowels-demo          # synthesised /i/ /ae/ /u/ /a/
```

`corpus vowels` exits non-zero if the vowel space is mis-ordered.

## How it works (pure standard library)

Formants are estimated with classic **LPC analysis**, implemented with no
third-party dependency so it runs anywhere the core does:

```
anti-alias low-pass + downsample to ~2×ceiling   (don't waste LPC order on the
pre-emphasis → Hamming window → autocorrelation    empty top band / alias it)
→ Levinson-Durbin (LPC coefficients)
→ Durand-Kerner polynomial root finding
→ formants from the angles of stable, narrow-bandwidth roots
```

This is the same method Praat uses. Validated against synthesised vowels with
known formants (`tests/test_formants.py`): F1 within ~70 Hz and F2 within ~50 Hz
across /i ae u a e o/.

### Why the downsampling matters

At 16 kHz the LPC order would be spent modelling the empty 5–8 kHz band, which
invents spurious poles and corrupts F2. Downsampling to ~2× the formant ceiling
(with a proper anti-aliasing low-pass) and using `order = 2·n_formants` gives a
tight, stable fit — this single change was what made F2 recovery reliable.

> Accuracy is calibrated for **corpus validation** ("are the vowels roughly where
> they should be"), not publication-grade per-token measurement. For the latter,
> cross-check individual tokens in Praat. numpy is *not* required; if present it
> could back a faster path, but the pure-Python estimator is the reference.

## What it reports

Per vowel category (ARPAbet for EN, IPA for JA):

- **mean F1 / F2** and their distribution (n, median, p25/p75, …)
- **target** formants and the **absolute error** vs. those targets
  (Hillenbrand-style EN references; 5-vowel JA references)
- corpus-level **mean target error (Hz)**
- **ordering_ok**: is the defining contrast right — /i/ (low F1, high F2) vs
  /a/ (high F1, low F2)? A scrambled space fails this.

## Health verdict

`ordering_ok = False` is a strong signal that vowel labels or alignment are
wrong (or the wrong language's targets are in use). A large `mean_target_error_hz`
suggests a sample-rate/calibration problem or systematically bad alignment. Fold
the result into the dataset card alongside WER/CER and boundary accuracy for a
complete, defensible quality picture before publication.
