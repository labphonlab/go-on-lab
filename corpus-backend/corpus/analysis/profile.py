"""Corpus profiling: validate health and surface research value, no gold data.

Computes, from segments the pipeline already produced:

  * coverage    — totals, speaker/language balance
  * acoustics   — SNR distribution
  * labels      — confidence distribution, empty-transcript rate, duplicates
  * timing      — speaking-rate distribution
  * phonetics   — phone-class duration stats + the vowel>plosive sanity check

It then raises HEALTH FLAGS: machine-checkable signs of trouble (broken
alignment, speaker imbalance, template contamination, low quality). The phone
duration check is the strongest gold-free probe of alignment quality — it leans
on the linguistic universal that vowels are, on average, longer than plosives.

Pure standard library.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from ..annotation.models import Segment
from ..models import ItemState
from . import phones as ph
from .stats import summarise, histogram, outlier_fraction

# Plausibility windows (seconds) for flagging, from phonetics norms.
_MIN_PHONE_S = 0.010      # phones below 10 ms are almost always alignment errors
_MAX_PHONE_S = 0.500
_MIN_WPS, _MAX_WPS = 1.0, 5.0   # words/sec plausible for connected speech


@dataclass
class HealthFlag:
    level: str          # "warn" | "error"
    code: str
    message: str

    def as_dict(self) -> dict:
        return {"level": self.level, "code": self.code, "message": self.message}


@dataclass
class CorpusProfile:
    coverage: dict
    acoustics: dict
    labels: dict
    timing: dict
    phonetics: dict
    flags: list = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "coverage": self.coverage,
            "acoustics": self.acoustics,
            "labels": self.labels,
            "timing": self.timing,
            "phonetics": self.phonetics,
            "flags": [f.as_dict() for f in self.flags],
        }


def _speaking_rates(segments: list[Segment]) -> list[float]:
    rates = []
    for s in segments:
        if s.transcript and s.transcript.text and s.duration_s > 0:
            nwords = len(s.transcript.text.split())
            if nwords:
                rates.append(nwords / s.duration_s)
    return rates


def _phone_durations_by_class(segments: list[Segment]) -> dict[str, list[float]]:
    by_class: dict[str, list[float]] = {}
    for s in segments:
        for p in s.phones:
            label = p.get("label", "")
            if not ph.is_phone(label):
                continue
            cls = ph.phone_class(label)
            dur = float(p.get("end_s", 0.0)) - float(p.get("start_s", 0.0))
            if dur > 0:
                by_class.setdefault(cls, []).append(dur)
    return by_class


def profile_corpus(segments: list[Segment], accepted_only: bool = False,
                   top_duplicates: int = 5) -> CorpusProfile:
    if accepted_only:
        segments = [s for s in segments if s.state == ItemState.ACCEPTED]
    flags: list[HealthFlag] = []

    # -- coverage -----------------------------------------------------------
    spk_dur = Counter()
    lang_dur = Counter()
    total_dur = 0.0
    for s in segments:
        total_dur += s.duration_s
        spk_dur[s.speaker] += s.duration_s
        lang = s.transcript.language if s.transcript else None
        lang_dur[lang or "unknown"] += s.duration_s
    coverage = {
        "segments": len(segments),
        "total_seconds": round(total_dur, 2),
        "total_hours": round(total_dur / 3600.0, 4),
        "speakers": len(spk_dur),
        "languages": dict(lang_dur and {k: round(v, 2) for k, v in lang_dur.items()}),
        "seconds_by_speaker": {k: round(v, 2) for k, v in spk_dur.most_common()},
    }
    # speaker-imbalance flag: one speaker dominates the corpus
    if total_dur > 0 and spk_dur:
        top_share = spk_dur.most_common(1)[0][1] / total_dur
        if len(spk_dur) > 1 and top_share > 0.8:
            flags.append(HealthFlag(
                "warn", "speaker_imbalance",
                f"one speaker is {top_share:.0%} of audio"))

    # -- acoustics ----------------------------------------------------------
    snrs = [s.scores["snr_db"] for s in segments
            if isinstance(s.scores.get("snr_db"), (int, float))]
    acoustics = {
        "snr_db": summarise(snrs).as_dict() if snrs else None,
        "snr_hist": histogram(snrs, bins=8) if snrs else [],
    }

    # -- labels -------------------------------------------------------------
    confs = [s.transcript.confidence for s in segments
             if s.transcript and isinstance(s.transcript.confidence, (int, float))]
    n_empty = sum(1 for s in segments
                  if not (s.transcript and s.transcript.text))
    texts = [s.transcript.text for s in segments
             if s.transcript and s.transcript.text]
    dup = Counter(texts)
    duplicates = [{"text": t, "count": c} for t, c in dup.most_common(top_duplicates)
                  if c > 1]
    empty_rate = n_empty / len(segments) if segments else 0.0
    labels = {
        "confidence": summarise(confs).as_dict() if confs else None,
        "empty_transcript_rate": round(empty_rate, 4),
        "duplicate_transcripts": duplicates,
        "distinct_transcripts": len(dup),
    }
    if empty_rate > 0.3:
        flags.append(HealthFlag(
            "warn", "high_empty_rate",
            f"{empty_rate:.0%} of segments have no transcript"))
    top_count = dup.most_common(1)[0][1] if texts else 0
    if texts and top_count > 1 and top_count / len(texts) > 0.2:
        flags.append(HealthFlag(
            "warn", "template_contamination",
            f"most common transcript is {top_count} occurrences"))

    # -- timing -------------------------------------------------------------
    rates = _speaking_rates(segments)
    timing = {
        "words_per_second": summarise(rates).as_dict() if rates else None,
        "implausible_rate_fraction": (round(outlier_fraction(rates, _MIN_WPS, _MAX_WPS), 4)
                                      if rates else 0.0),
    }
    if rates and outlier_fraction(rates, _MIN_WPS, _MAX_WPS) > 0.2:
        flags.append(HealthFlag(
            "warn", "implausible_speaking_rate",
            ">20% of segments have an implausible words/sec (label/align suspect)"))

    # -- phonetics (the gold-free alignment check) --------------------------
    by_class = _phone_durations_by_class(segments)
    class_summ = {cls: summarise(durs).as_dict() for cls, durs in by_class.items()}
    all_phone_durs = [d for durs in by_class.values() for d in durs]
    sub10 = (sum(1 for d in all_phone_durs if d < _MIN_PHONE_S) / len(all_phone_durs)
             if all_phone_durs else 0.0)

    vowel_mean = (sum(by_class["vowel"]) / len(by_class["vowel"])
                  if by_class.get("vowel") else None)
    plosive_mean = (sum(by_class["plosive"]) / len(by_class["plosive"])
                    if by_class.get("plosive") else None)
    vowel_gt_plosive = (None if vowel_mean is None or plosive_mean is None
                        else vowel_mean > plosive_mean)
    phonetics = {
        "has_phone_alignment": bool(all_phone_durs),
        "n_phones": len(all_phone_durs),
        "duration_by_class": class_summ,
        "sub_10ms_fraction": round(sub10, 4),
        "vowel_mean_s": (round(vowel_mean, 4) if vowel_mean is not None else None),
        "plosive_mean_s": (round(plosive_mean, 4) if plosive_mean is not None else None),
        "vowel_longer_than_plosive": vowel_gt_plosive,
    }
    if all_phone_durs:
        if sub10 > 0.1:
            flags.append(HealthFlag(
                "error", "degenerate_phone_durations",
                f"{sub10:.0%} of phones are <10 ms — alignment likely broken"))
        if vowel_gt_plosive is False:
            flags.append(HealthFlag(
                "error", "vowel_not_longer_than_plosive",
                "mean vowel duration <= mean plosive duration — alignment suspect "
                f"(vowel={vowel_mean:.3f}s, plosive={plosive_mean:.3f}s)"))

    return CorpusProfile(coverage, acoustics, labels, timing, phonetics, flags)


def render_markdown(profile: CorpusProfile, name: str = "Go-on Lab Corpus") -> str:
    """Human-readable profile report for inclusion in a dataset card / review."""
    p = profile
    L = [f"# {name} — Corpus Profile", ""]

    L += ["## Health flags", ""]
    if not p.flags:
        L.append("- ✅ No health flags raised.")
    for f in p.flags:
        icon = "🛑" if f.level == "error" else "⚠️"
        L.append(f"- {icon} **{f.code}**: {f.message}")
    L.append("")

    c = p.coverage
    L += ["## Coverage", "",
          f"- Segments: {c['segments']}",
          f"- Audio: {c['total_hours']} h ({c['total_seconds']} s)",
          f"- Speakers: {c['speakers']}",
          f"- Languages: {c['languages']}", ""]

    if p.acoustics["snr_db"]:
        s = p.acoustics["snr_db"]
        L += ["## Acoustics", "",
              f"- SNR dB: median {s['median']}, p25 {s['p25']}, p95 {s['p95']}", ""]

    lab = p.labels
    L += ["## Labels", "",
          f"- Empty-transcript rate: {lab['empty_transcript_rate']:.1%}",
          f"- Distinct transcripts: {lab['distinct_transcripts']}"]
    if lab["confidence"]:
        L.append(f"- ASR confidence: median {lab['confidence']['median']}")
    if lab["duplicate_transcripts"]:
        L.append(f"- Top duplicate: {lab['duplicate_transcripts'][0]}")
    L.append("")

    ph_ = p.phonetics
    L += ["## Phonetics (gold-free alignment check)", ""]
    if ph_["has_phone_alignment"]:
        L += [f"- Phones: {ph_['n_phones']}",
              f"- <10 ms fraction: {ph_['sub_10ms_fraction']:.1%}",
              f"- Mean vowel: {ph_['vowel_mean_s']} s, "
              f"mean plosive: {ph_['plosive_mean_s']} s",
              f"- Vowel longer than plosive: {ph_['vowel_longer_than_plosive']}"]
        L += ["", "| class | n | median (s) |", "|---|---|---|"]
        for cls, st in sorted(ph_["duration_by_class"].items()):
            L.append(f"| {cls} | {st['n']} | {st['median']} |")
    else:
        L.append("- No phone alignment present (run MFA to enable this check).")
    L.append("")
    return "\n".join(L)
