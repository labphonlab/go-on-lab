# Corpus Profile — pre-publication health check & research value

Before using a corpus for your own research (and certainly before publishing
it), profile it. `corpus.analysis.profile` computes a health + value report from
the segments the pipeline already produced — **no gold data, no extra
dependencies**. It both validates the data and demonstrates what the corpus can
support.

```bash
corpus profile --segments segments.jsonl --markdown --out profile.md
corpus profile-demo          # synthetic demo
```

`corpus profile` exits with code **2** if any *error*-level health flag fires, so
it works as a pre-publication QA gate in CI/scripts.

## What it reports

| Section | Content | Why it matters |
|---|---|---|
| **Coverage** | segments, hours, speakers, language balance, seconds/speaker | spot imbalance/bias before it biases results |
| **Acoustics** | SNR distribution + histogram | catch recording/transcoding defects |
| **Labels** | confidence distribution, empty-transcript rate, duplicate transcripts | catch template contamination & data leakage |
| **Timing** | words/sec distribution, implausible-rate fraction | outlier speaking rates flag bad labels/alignment |
| **Phonetics** | phone-class duration stats + the vowel>plosive check | **gold-free alignment validation** |

## The gold-free alignment check (the centrepiece)

You usually have no hand-corrected alignment to compare against. But you do have
**linguistic universals**, and they are enough to expose a broken aligner:

1. **Vowels are, on average, longer than plosives.** If the corpus violates this
   (`vowel_longer_than_plosive = False`), the phone alignment is suspect — raised
   as an **error** flag.
2. **Phones are not ~1 ms long.** A high `sub_10ms_fraction` (>10%) means the
   aligner collapsed phones onto each other — raised as an **error** flag.

These two checks caught a deliberately-broken alignment in testing (vowels set
shorter than plosives) and exit the tool non-zero — exactly the behaviour you
want guarding a publication step.

Phone classification (`analysis/phones.py`) handles both **ARPAbet/MFA**
(`AA1`, `P`, `SH`, stress digits stripped) and **IPA** symbols, so it works with
either aligner model.

## Health flags

| code | level | trigger |
|---|---|---|
| `speaker_imbalance` | warn | one speaker > 80% of audio |
| `high_empty_rate` | warn | > 30% of segments lack a transcript |
| `template_contamination` | warn | most-common transcript > 20% of segments |
| `implausible_speaking_rate` | warn | > 20% of segments outside 1–5 words/sec |
| `degenerate_phone_durations` | **error** | > 10% of phones < 10 ms |
| `vowel_not_longer_than_plosive` | **error** | mean vowel ≤ mean plosive |

## Recommended workflow before research/publication

1. `corpus profile --segments ... --markdown` → read the flags.
2. Resolve **error** flags (usually re-run/repair alignment; check the aligner
   model matches the language).
3. For **warn** flags, decide if the bias matters for your research question
   (e.g. speaker imbalance is fine for a single-speaker study).
4. Measure label quality (`docs/WER_WORKFLOW.md`) and alignment accuracy on a
   sample (`docs/BOUNDARY_EVAL.md`).
5. Fold the profile + measured error rates into the dataset card, then publish.

Pure standard library throughout.
