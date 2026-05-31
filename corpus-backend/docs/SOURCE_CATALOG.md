# Source Catalog — easy-to-obtain, under-labeled audio

Target acquisition strategy: **audio that is cheap/easy to obtain but not yet
seriously labeled or analysed**, so the value we add (segmentation, labeling,
forced alignment, phonetic/prosodic analysis) is real and novel.

Selection criteria, in priority order:

1. **Clean rights** for research use (public domain > CC0 > CC-BY > gov data).
2. **Under-labeled**: no fine-grained time alignment, no phone labels, no
   published phonetic/prosodic analysis — i.e. room to add value.
3. **Easy to obtain**: open API / direct download, no gatekeeping.
4. **Fits the goal**: JA / EN / multilingual.

## Ranked candidates

### Tier 1 — recommended first targets

| Corpus | Lang | How to obtain | Label status | License |
|---|---|---|---|---|
| **LibriVox** | EN + ~30 langs | librivox.org API + archive.org; text from Project Gutenberg | Chapter text only; most is **not** segmented/aligned (LibriSpeech used a curated EN subset) | **Public domain** |
| **国会審議 + 会議録** (Diet) | JA | Diet TV / NDL audio; verbatim text via 国会会議録検索 API | Verbatim transcript exists but **not time-aligned**, no phonetic analysis | Japanese government data (confirm terms) |
| **VoxPopuli (unlabeled)** | 23 EU langs | facebookresearch/voxpopuli | **100k h unlabeled** subset | CC0 |

Why these win: LibriVox is read speech with **known text and bulletproof rights
(PD)**, yet most of it has never been aligned or analysed. The Diet has a
**verbatim record that has never been time-aligned to the audio** — a textbook
"text exists, labels/analysis don't" case for Japanese.

### Tier 2 — large but messier

| Corpus | Lang | Note |
|---|---|---|
| The People's Speech | EN | 30k h, CC-BY/CC-BY-SA, transcripts are noisy → re-labeling adds value |
| Common Voice (other/unvalidated) | many | Sentences exist but **no phone alignment / phonetic analysis** — add that layer |
| TalkBank (CHILDES etc.) | many | Conversational, partly unaligned; mostly research-only licenses |

### Avoid as primary

- Already gold-labeled (CSJ, GigaSpeech, TIMIT) — no labeling value to add.
- ToS-encumbered scrapes (arbitrary YouTube) — rights risk for redistribution.

## Legal posture (research use)

For found/public audio used in **non-commercial research**, Japan's Copyright
Act **Art. 30-4 (information analysis)** gives wide latitude for analysis-purpose
use. It does **not** override site terms of service / access controls, nor
personal-data and research-ethics duties (IRB / 倫理審査, pseudonymisation,
informed consent where speakers are identifiable). Public-domain sources
(LibriVox) and CC0 sources (VoxPopuli) avoid the copyright question entirely and
are the safest first targets. *Not legal advice — confirm with your institution.*

## How this maps to the code

Each source is an adapter implementing `corpus.acquisition.source.Source`:
`catalog()` lists items with their license/attribution, `fetch()` downloads one.
The registry records license + provenance + a content hash (dedup) into an
acquisition manifest, after which the annotation pipeline labels the audio.

- `adapters/local_dir.py` — ingest a local folder (fully offline, the test path).
- `adapters/librivox.py` — public-domain audiobooks (lazy network).
- `adapters/voxpopuli.py` — CC0 European Parliament unlabeled (lazy network).
- `adapters/diet_jp.py` — Japanese Diet audio + verbatim record (lazy network).
