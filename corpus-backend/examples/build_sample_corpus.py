"""Build a small, runnable SAMPLE corpus end to end.

This stands in for "ingest a public corpus (LibriVox/VoxPopuli) then auto
segment + label it" in an environment with no network / GPU / ffmpeg. What is
REAL here vs. simulated:

  REAL (computed by the actual system code):
    - acquisition: provenance + content-hash dedup + manifest
    - audio QC: SNR / clipping / silence gating
    - vowel formant (F1/F2) measurement via the pure-Python LPC analyser
    - corpus profile + health flags + the vowel-space ordering check
    - exports: Praat TextGrid, ELAN EAF, Hugging Face datasets
    - the unified QUALITY_REPORT with its ready/not-ready verdict

  SIMULATED (stand-ins for tools that need GPU/network here):
    - the audio is source-filter *synthesised* read speech (real vowel
      formants embedded) rather than a downloaded LibriVox clip
    - word transcripts + per-word/phone time alignments are the representative
      output WhisperX + MFA would produce, attached so the downstream analysis
      is exercised on realistic labels

Run:  python examples/build_sample_corpus.py --out /tmp/sample_corpus
"""

from __future__ import annotations

import argparse
import math
import os
import struct
import sys
import wave

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from corpus.acquisition.registry import AcquisitionRegistry
from corpus.acquisition.adapters.local_dir import LocalDirectorySource
from corpus.annotation.models import Segment, Transcript, WordTiming
from corpus.annotation import manifest as ann_manifest
from corpus.audio.wav import read_wav
from corpus.analysis.vowel_space import measure_segment_vowels, analyze_vowel_space
from corpus.analysis.profile import profile_corpus
from corpus.analysis.report import QualityReport, render_report
from corpus.analysis.plot import write_vowel_space_svg
from corpus.models import License, ItemState
from corpus import export as exporters

SR = 16000

# Formants (F1,F2,F3,F4) for the vowels we embed, ARPAbet labels.
VOWELS = {
    "IY": (300, 2300, 3000, 3500),   # beet
    "IH": (430, 2000, 2800, 3500),   # bit
    "EH": (580, 1800, 2600, 3500),   # bet
    "AE": (700, 1700, 2600, 3600),   # bat
    "AA": (750, 1100, 2550, 3500),   # bot
    "AO": (600, 900, 2600, 3500),    # bought
    "UW": (350, 900, 2400, 3400),    # boot
    "ER": (500, 1400, 1700, 3300),   # bird
}

# Three short "audiobook" sentences (public-domain style), with the ARPAbet
# pronunciation we synthesise. Consonants are rendered as brief noise/closure;
# vowels carry real formants so the F1/F2 analysis is meaningful.
UTTERANCES = [
    {
        "speaker": "SPEAKER_00",
        "text": "the sea is calm",
        # (word, [(phone, dur_s)])
        "words": [
            ("the", [("DH", 0.05), ("AH", 0.08)]),
            ("sea", [("S", 0.10), ("IY", 0.18)]),
            ("is", [("IH", 0.09), ("Z", 0.07)]),
            ("calm", [("K", 0.06), ("AA", 0.20), ("M", 0.08)]),
        ],
    },
    {
        "speaker": "SPEAKER_00",
        "text": "a bird sat there",
        "words": [
            ("a", [("AH", 0.07)]),
            ("bird", [("B", 0.05), ("ER", 0.20), ("D", 0.05)]),
            ("sat", [("S", 0.10), ("AE", 0.17), ("T", 0.05)]),
            ("there", [("DH", 0.05), ("EH", 0.16)]),
        ],
    },
    {
        "speaker": "SPEAKER_01",
        "text": "you bought two boots",
        "words": [
            ("you", [("Y", 0.05), ("UW", 0.16)]),
            ("bought", [("B", 0.05), ("AO", 0.19), ("T", 0.05)]),
            ("two", [("T", 0.05), ("UW", 0.17)]),
            ("boots", [("B", 0.05), ("UW", 0.15), ("T", 0.05), ("S", 0.09)]),
        ],
    },
]


def _vowel_samples(formants, dur_s, f0=120):
    n = int(SR * dur_s)
    src = [0.0] * n
    for i in range(0, n, int(SR / f0)):
        src[i] = 1.0
    y = src
    for F, B in zip(formants, (60, 90, 120, 150)):
        r = math.exp(-math.pi * B / SR)
        th = 2 * math.pi * F / SR
        a1, a2 = -2 * r * math.cos(th), r * r
        out = [0.0] * n
        for i in range(n):
            v = y[i]
            if i >= 1:
                v -= a1 * out[i - 1]
            if i >= 2:
                v -= a2 * out[i - 2]
            out[i] = v
        y = out
    mx = max((abs(v) for v in y), default=1.0) or 1.0
    return [0.6 * v / mx for v in y]


def _consonant_samples(label, dur_s, rng_state):
    """Brief noise (fricatives) or low-energy closure (stops) — enough for QC."""
    n = int(SR * dur_s)
    fricatives = {"S", "Z", "DH", "TH", "F", "V", "SH"}
    out = []
    x = rng_state[0]
    for _ in range(n):
        x = (1103515245 * x + 12345) & 0x7FFFFFFF
        noise = (x / 0x3FFFFFFF) - 1.0
        out.append(0.18 * noise if label in fricatives else 0.02 * noise)
    rng_state[0] = x
    return out


def synth_utterance(utt):
    """Return (samples, words_with_timings, phones_with_timings), absolute times."""
    samples = []
    words_t = []
    phones_t = []
    rng = [12345]
    t = 0.0
    # short lead silence
    samples += [0.0] * int(SR * 0.12)
    t += 0.12
    for word, phones in utt["words"]:
        w_start = t
        word_conf = 0.0
        nconf = 0
        for phone, dur in phones:
            if phone in VOWELS:
                seg = _vowel_samples(VOWELS[phone], dur)
                conf = 0.97
            else:
                seg = _consonant_samples(phone, dur, rng)
                conf = 0.90
            samples += seg
            phones_t.append({"start_s": round(t, 4), "end_s": round(t + dur, 4),
                             "label": phone})
            t += dur
            word_conf += conf
            nconf += 1
        words_t.append(WordTiming(word, round(w_start, 4), round(t, 4),
                                  round(word_conf / max(1, nconf), 3)))
        # brief inter-word gap
        samples += [0.0] * int(SR * 0.04)
        t += 0.04
    samples += [0.0] * int(SR * 0.12)
    t += 0.12
    return samples, words_t, phones_t


def write_wav(path, samples):
    maxv = 32767
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s)) * maxv)) for s in samples))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="./_sample_corpus")
    args = ap.parse_args(argv)
    out = args.out
    raw = os.path.join(out, "raw")
    os.makedirs(raw, exist_ok=True)

    # 1) Synthesise "audiobook" recordings and remember the gold labels.
    gold = {}  # filename -> (words, phones, speaker, text)
    for i, utt in enumerate(UTTERANCES):
        samples, words_t, phones_t = synth_utterance(utt)
        fname = f"utt_{i:03d}.wav"
        write_wav(os.path.join(raw, fname), samples)
        gold[fname] = (words_t, phones_t, utt["speaker"], utt["text"])
    # add an exact duplicate to demonstrate content-hash dedup
    import shutil
    shutil.copy2(os.path.join(raw, "utt_000.wav"),
                 os.path.join(raw, "utt_000_copy.wav"))

    # 2) REAL acquisition: provenance + dedup + manifest.
    reg = AcquisitionRegistry(os.path.join(out, "store"))
    acquired = reg.acquire_from(LocalDirectorySource(raw, language="en",
                                                     license=License.CC0_1_0))
    print(f"acquired {len(acquired)} recording(s) "
          f"(duplicate dropped by content hash); "
          f"licenses={reg.license_summary()}")

    # 3) Build labeled segments. The WhisperX/MFA labels are attached from the
    #    gold we synthesised (stand-in for the real ASR+aligner output).
    segments = []
    wav_by_source = {}
    for a in acquired:
        wav = read_wav(a.local_path)
        wav_by_source[a.item_id] = wav
        words_t, phones_t, speaker, text = gold[a.item_id]
        seg = Segment(
            segment_id=f"{a.item_id}#0000", source_id=a.item_id,
            start_s=words_t[0].start_s, end_s=words_t[-1].end_s, speaker=speaker,
            transcript=Transcript(text=text, language="en",
                                  confidence=round(sum(w.confidence for w in words_t)
                                                   / len(words_t), 3),
                                  words=words_t, is_heuristic=False),
            phones=phones_t, scores={})
        # REAL QC metric: per-segment SNR via the analysis helper.
        from corpus.annotation.orchestrator import _segment_snr_db
        seg.scores["snr_db"] = round(_segment_snr_db(wav, seg.start_s, seg.end_s), 2)
        seg.state = ItemState.ACCEPTED
        segments.append(seg)

    ann_manifest.write_segments_jsonl(segments,
                                      os.path.join(out, "segments.jsonl"))
    print(f"built {len(segments)} labeled segment(s)")

    # 4) REAL analysis: vowel formants, profile, unified report.
    measurements = []
    for seg in segments:
        measurements.extend(measure_segment_vowels(wav_by_source[seg.source_id], seg))
    vspace = analyze_vowel_space(measurements, language="en")
    profile = profile_corpus(segments)
    report = QualityReport(profile=profile, vowel_space=vspace)

    with open(os.path.join(out, "QUALITY_REPORT.md"), "w", encoding="utf-8") as fh:
        fh.write(render_report(report, name="Go-on Lab Sample Corpus"))
    write_vowel_space_svg(vspace, os.path.join(out, "vowel_space.svg"),
                          title="Sample corpus vowel space (F1/F2)")

    # 5) REAL exports to research tools.
    counts = exporters.export_all(segments, os.path.join(out, "export"),
                                  media_dir=os.path.join(out, "store", "audio"))

    print(f"vowels measured: {vspace.n_vowels_measured}; "
          f"ordering_ok={vspace.ordering_ok}; "
          f"mean target error={vspace.mean_target_error_hz} Hz")
    print(f"corpus ready: {report.is_ready()}")
    print(f"exports: {counts}")
    print(f"\nAll outputs under: {out}/")
    for rel in ["segments.jsonl", "QUALITY_REPORT.md", "vowel_space.svg",
                "store/acquisition.jsonl", "export/praat/", "export/elan/",
                "export/hf/metadata.jsonl"]:
        print(f"  - {rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
