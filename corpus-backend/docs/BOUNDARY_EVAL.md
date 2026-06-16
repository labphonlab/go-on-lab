# Boundary Accuracy Evaluation

WER/CER (`docs/WER_WORKFLOW.md`) measure *what* was said. Phonetic research also
needs *when* — how accurately the forced aligner placed word/phone boundaries.
`corpus.alignment.boundary_eval` measures that against a reference alignment.

## Metrics (the field-standard report)

Given a reference TextGrid tier (hand-corrected / gold) and a hypothesis tier
(the aligner's output):

- **Mean / median absolute boundary error** (ms) — central tendency of the gap
  between corresponding reference and hypothesis boundaries.
- **Max absolute error** (ms) — worst slip, surfaces gross misalignments.
- **Tolerance accuracy** — fraction of boundaries within 10 / 20 / 50 ms of
  reference. The 20 ms figure is the one most phonetics papers quote.

## Robust label matching

The reference and hypothesis label sequences are aligned with Levenshtein
backtracing, so the comparison survives the aligner inserting or deleting a unit:
only **matched** (same-label) intervals contribute boundary errors, while
insertions/deletions are reported as counts (`n_ref`, `n_hyp`, `n_matched`).
Empty intervals (silence) are skipped by default.

## Use

```bash
# Compare two TextGrids (e.g. gold vs MFA output) on the phones tier:
corpus boundary --ref gold.TextGrid --hyp mfa.TextGrid --tier phones

# Synthetic demo:
corpus boundary-demo
```

```python
from corpus.alignment.boundary_eval import boundary_errors_from_textgrids
res = boundary_errors_from_textgrids("gold.TextGrid", "mfa.TextGrid", tier="phones")
print(res.as_dict())
# {'mean_abs_error_ms': 18.0, 'within': {'20ms': 0.8, ...}, ...}
```

## How this fits the pipeline

The aligner output (MFA phones, or the proportional baseline) is already
attachable to segments and exportable as TextGrid (`corpus.export.praat`). To
report alignment quality for a corpus, hand-correct a sample of those TextGrids
(the same sampling idea as the WER review sheet), then run `boundary` against the
corrected references and publish the mean error + 20 ms accuracy in the dataset
card — the alignment counterpart to the measured WER/CER.

Pure standard library; no network or ML needed.
