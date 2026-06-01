# Error-Rate Measurement Workflow (half-automated)

Auto-generated labels are not a research corpus until their error rate is
**measured and published**. This workflow automates everything except the one
step only a human can do — saying what was actually said.

```
segments.jsonl
   │  corpus review-sheet  (stratified sample -> CSV)
   ▼
review.csv  ──(a human fills 'ok' or 'corrected_transcript')──▶  review.csv
   │  corpus measure  (ingest -> WER/CER + 95% CI + per-band -> dataset card)
   ▼
DATASET_CARD.md  (citable label-quality figures)
```

## Why these design choices

- **CER as well as WER.** Japanese has no reliable word segmentation, so WER is
  unstable; character error rate (whitespace-stripped) is the robust metric for
  JA and a useful complement for EN. Both are reported.
- **Stratified sampling by confidence band.** A uniform sample is dominated by
  the most common band. Stratifying guarantees the rare low-confidence segments
  are verified too, and yields a **per-band error table** — the empirical basis
  for choosing the auto-accept confidence threshold.
- **Bootstrap 95% CI.** A point estimate from a small sample is misleading.
  Resampling segments with replacement gives an honest interval, reported in the
  card.
- **`ok` shortcut.** Most ASR lines are already correct; a truthy `ok` reuses the
  hypothesis as the reference so verifiers only retype genuine errors.

## Commands

```bash
# 1. Sample a review sheet (stratified across confidence bands).
corpus review-sheet --segments segments.jsonl --out review.csv --n 200 --stratified

# 2. A human edits review.csv: set 'ok' = x where the ASR is correct, else fill
#    'corrected_transcript'. Partial progress is fine.

# 3. Measure and update the dataset card.
corpus measure --segments segments.jsonl --sheet review.csv --card DATASET_CARD.md

# End-to-end demo (auto-fills a plausible sheet, no human needed):
corpus eval-demo --out /tmp/evald
```

## Output

`measure` prints, and writes into the dataset card:

- overall **WER** and **CER**, each with a 95% bootstrap CI and raw counts;
- a **by-band** table (n, WER, CER per confidence band);
- review progress (how much of the sheet is done).

## API

```python
from corpus.annotation.evaluation import stratified_sample, measure_error_rates
from corpus.annotation.review_sheet import write_review_sheet, read_corrections

sample = stratified_sample(segments, n=200)
write_review_sheet(sample, "review.csv")
# ... human fills review.csv ...
result = measure_error_rates(read_corrections("review.csv"), segments)
print(result.as_dict())   # wer, cer, wer_ci95, cer_ci95, by_band, ...
```

Pure standard library throughout — runs anywhere, no network or ML needed.
