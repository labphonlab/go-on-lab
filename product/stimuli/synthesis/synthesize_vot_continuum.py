"""
VOT continuum Klatt synthesizer.

Generates a complete stimulus package (WAV files at 3 sample rates,
acoustic parameters CSV, perception_lab_config.json, README, license
file, technical note skeleton) from a single YAML config.

Usage:
    python synthesize_vot_continuum.py configs/jpn_kg_vot.yaml
    python synthesize_vot_continuum.py configs/jpn_kg_vot.yaml --out output_dir

The synthesis path is Praat's KlattGrid driven via parselmouth, so the
generated WAVs share no waveform with any source recording.
"""

import argparse
import csv
import json
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import parselmouth
import soundfile as sf
import yaml
from parselmouth.praat import call


# ---------- Config dataclasses ----------

@dataclass
class Formant:
    freq: float
    bw: float


@dataclass
class Timing:
    lead_silence_ms: float
    closure_ms: float
    burst_ms: float
    vowel_ms: float
    trail_silence_ms: float


@dataclass
class Config:
    set_id: str
    set_name: str
    language: str
    contrast: str
    vowel: str
    vot_steps_ms: list[float]
    formants: list[Formant]
    f0_start_hz: float
    f0_end_hz: float
    timing: Timing
    burst_type: str
    burst_intensity_db: float
    aspiration_intensity_db: float
    voicing_intensity_db: float
    prevoicing_intensity_db: float
    sample_rates_hz: list[int]

    @classmethod
    def from_yaml(cls, path: Path) -> "Config":
        with path.open(encoding="utf-8") as fp:
            data = yaml.safe_load(fp)
        formants = [
            Formant(freq=data["formants"][k]["freq"], bw=data["formants"][k]["bw"])
            for k in sorted(data["formants"].keys())
        ]
        timing = Timing(
            lead_silence_ms=data["timing"]["lead_silence"],
            closure_ms=data["timing"]["closure"],
            burst_ms=data["timing"]["burst"],
            vowel_ms=data["timing"]["vowel"],
            trail_silence_ms=data["timing"]["trail_silence"],
        )
        return cls(
            set_id=data["set_id"],
            set_name=data["set_name"],
            language=data["language"],
            contrast=data["contrast"],
            vowel=data["vowel"],
            vot_steps_ms=list(data["vot_steps_ms"]),
            formants=formants,
            f0_start_hz=data["f0"]["start"],
            f0_end_hz=data["f0"]["end"],
            timing=timing,
            burst_type=data["burst"]["type"],
            burst_intensity_db=data["burst"]["intensity_db"],
            aspiration_intensity_db=data["aspiration"]["intensity_db"],
            voicing_intensity_db=data.get("voicing", {}).get("intensity_db", 70.0),
            prevoicing_intensity_db=data.get("voicing", {}).get("prevoicing_intensity_db", 55.0),
            sample_rates_hz=list(data["sample_rates_hz"]),
        )


# ---------- Burst spectrum shaping ----------

# Burst formant emphasis differs by place of articulation. These are the
# approximate spectral peaks for the burst (frication formants in KlattGrid).
# References: Stevens (1998), Acoustic Phonetics, MIT Press; Klatt (1987).
BURST_FRICATION_FORMANTS: dict[str, list[Formant]] = {
    "labial":  [Formant(500, 300), Formant(1500, 400), Formant(3000, 500)],
    "dental":  [Formant(2500, 300), Formant(4000, 500), Formant(6000, 700)],
    "velar":   [Formant(1800, 300), Formant(2500, 400), Formant(4000, 600)],
}


# ---------- KlattGrid construction ----------

def _build_klattgrid(vot_ms: float, cfg: Config) -> parselmouth.Data:
    """
    Build a KlattGrid for one VOT step.

    Timeline (seconds):
        t=0                       : start (silence)
        t_closure_start           : closure begins (may be voiced for negative VOT)
        t_burst                   : stop release transient
        t_voicing_onset           : modal voicing onset (t_burst + vot)
        t_vowel_end               : vowel ends
        t_end                     : trailing silence ends

    VOT convention: positive = aspirated (voicing AFTER burst),
                    negative = prevoiced (voicing BEFORE burst).
    """
    vot_s = vot_ms / 1000.0
    timing = cfg.timing

    lead_silence_s = timing.lead_silence_ms / 1000.0
    closure_s = timing.closure_ms / 1000.0
    burst_s = timing.burst_ms / 1000.0
    vowel_s = timing.vowel_ms / 1000.0
    trail_silence_s = timing.trail_silence_ms / 1000.0

    # For very negative VOT, ensure the closure is long enough to contain
    # the prevoicing window without bleeding into the lead silence.
    if vot_s < 0 and abs(vot_s) + 0.020 > closure_s:
        closure_s = abs(vot_s) + 0.020

    t_closure_start = lead_silence_s
    t_burst = t_closure_start + closure_s
    t_voicing_onset = t_burst + vot_s  # earlier than burst when vot_s < 0
    t_vowel_end = max(t_burst, t_voicing_onset) + vowel_s
    t_end = t_vowel_end + trail_silence_s

    n_oral_formants = len(cfg.formants)
    n_frication_formants = len(BURST_FRICATION_FORMANTS[cfg.burst_type])

    # Create KlattGrid: (name, t_start, t_end, n_oralFormants, n_nasalFormants,
    #                   n_nasalAntiFormants, n_fricationFormants, n_trachealFormants,
    #                   n_trachealAntiFormants, n_deltaFormants)
    kg = call(
        "Create KlattGrid",
        "vot_token",
        0.0, t_end,
        n_oral_formants, 0, 0,
        n_frication_formants, 0, 0,
        0,
    )

    _set_pitch(kg, cfg, t_voicing_onset, t_vowel_end)
    _set_voicing(kg, cfg, vot_s, t_voicing_onset, t_burst, t_vowel_end, t_end)
    _set_formants(kg, cfg, t_burst, t_vowel_end)
    _set_burst_and_aspiration(kg, cfg, vot_s, t_burst, t_voicing_onset)

    sound = call(kg, "To Sound")
    return sound


def _set_pitch(kg: parselmouth.Data, cfg: Config, t_voicing_onset: float, t_vowel_end: float) -> None:
    """Linear F0 contour over the voiced span (prevoicing + vowel)."""
    pitch_start = max(0.0, t_voicing_onset - 0.005)
    call(kg, "Add pitch point", pitch_start, cfg.f0_start_hz)
    call(kg, "Add pitch point", t_vowel_end, cfg.f0_end_hz)


def _set_voicing(
    kg: parselmouth.Data,
    cfg: Config,
    vot_s: float,
    t_voicing_onset: float,
    t_burst: float,
    t_vowel_end: float,
    t_end: float,
) -> None:
    """
    Voicing amplitude envelope.
        - silence before voicing
        - prevoicing (reduced amplitude) during closure if vot < 0
        - modal voicing during the vowel
        - silence after
    """
    # Hard zero before voicing starts.
    call(kg, "Add voicing amplitude point", 0.0, 0.0)
    if t_voicing_onset > 0.001:
        call(kg, "Add voicing amplitude point", t_voicing_onset - 0.001, 0.0)

    if vot_s < 0:
        # Prevoicing at reduced amplitude during closure.
        call(kg, "Add voicing amplitude point", t_voicing_onset, cfg.prevoicing_intensity_db)
        call(kg, "Add voicing amplitude point", t_burst, cfg.prevoicing_intensity_db)
        # Step up to modal voicing right after burst.
        call(kg, "Add voicing amplitude point", t_burst + 0.005, cfg.voicing_intensity_db)
    else:
        # Modal voicing from voicing onset onwards.
        call(kg, "Add voicing amplitude point", t_voicing_onset, cfg.voicing_intensity_db)

    call(kg, "Add voicing amplitude point", t_vowel_end, cfg.voicing_intensity_db)
    if t_vowel_end + 0.001 < t_end:
        call(kg, "Add voicing amplitude point", t_vowel_end + 0.001, 0.0)


def _set_formants(kg: parselmouth.Data, cfg: Config, t_burst: float, t_vowel_end: float) -> None:
    """Oral formant frequencies and bandwidths held constant across the vowel."""
    # Anchor formants slightly before the burst so prevoicing is also shaped.
    t_anchor_start = max(0.0, t_burst - 0.050)
    for i, fm in enumerate(cfg.formants, start=1):
        call(kg, "Add oral formant frequency point", i, t_anchor_start, fm.freq)
        call(kg, "Add oral formant frequency point", i, t_vowel_end, fm.freq)
        call(kg, "Add oral formant bandwidth point", i, t_anchor_start, fm.bw)
        call(kg, "Add oral formant bandwidth point", i, t_vowel_end, fm.bw)


def _set_burst_and_aspiration(
    kg: parselmouth.Data,
    cfg: Config,
    vot_s: float,
    t_burst: float,
    t_voicing_onset: float,
) -> None:
    """
    Burst: brief frication transient at release.
    Aspiration: noise between burst end and voicing onset, only for positive VOT.
    """
    burst_dur = cfg.timing.burst_ms / 1000.0

    # Frication formants (place-dependent spectral shape of the burst).
    frication_formants = BURST_FRICATION_FORMANTS[cfg.burst_type]
    for i, fm in enumerate(frication_formants, start=1):
        call(kg, "Add frication formant frequency point", i, t_burst, fm.freq)
        call(kg, "Add frication formant bandwidth point", i, t_burst, fm.bw)

    # Burst envelope: zero -> peak -> decay over burst_dur.
    call(kg, "Add frication amplitude point", max(0.0, t_burst - 0.002), 0.0)
    call(kg, "Add frication amplitude point", t_burst, cfg.burst_intensity_db)
    call(kg, "Add frication amplitude point", t_burst + burst_dur, cfg.burst_intensity_db - 10.0)

    if vot_s > 0:
        # Aspiration sustained between burst end and voicing onset.
        asp_start = t_burst + burst_dur
        asp_end = max(asp_start + 0.003, t_voicing_onset - 0.003)
        call(kg, "Add frication amplitude point", asp_start + 0.001, cfg.aspiration_intensity_db)
        call(kg, "Add frication amplitude point", asp_end, cfg.aspiration_intensity_db)
        call(kg, "Add frication amplitude point", t_voicing_onset, 0.0)
    else:
        call(kg, "Add frication amplitude point", t_burst + burst_dur + 0.001, 0.0)


# ---------- Resampling and normalization ----------

def _normalize_loudness(samples: np.ndarray, target_dbfs: float = -23.0) -> np.ndarray:
    """Simple peak-aware RMS normalization. Not full BS.1770 but sufficient for stimuli."""
    rms = float(np.sqrt(np.mean(samples ** 2)))
    if rms < 1e-9:
        return samples
    current_dbfs = 20.0 * np.log10(rms)
    gain_db = target_dbfs - current_dbfs
    gain = 10 ** (gain_db / 20.0)
    out = samples * gain
    peak = float(np.max(np.abs(out)))
    if peak > 0.99:
        out = out * (0.99 / peak)
    return out


def _resample(samples: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
    if src_rate == dst_rate:
        return samples
    # Linear-phase polyphase resampling via scipy if available, else naive.
    try:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(src_rate, dst_rate)
        return resample_poly(samples, dst_rate // g, src_rate // g)
    except ImportError:
        # Fallback: simple linear interpolation.
        n_out = int(round(len(samples) * dst_rate / src_rate))
        x_in = np.linspace(0, 1, len(samples))
        x_out = np.linspace(0, 1, n_out)
        return np.interp(x_out, x_in, samples)


# ---------- Package generation ----------

def synthesize_continuum(cfg: Config, out_root: Path) -> None:
    set_dir = out_root / cfg.set_id
    set_dir.mkdir(parents=True, exist_ok=True)

    for sr in cfg.sample_rates_hz:
        (set_dir / "wav" / _rate_label(sr)).mkdir(parents=True, exist_ok=True)

    csv_rows: list[dict[str, Any]] = []
    config_stimuli: list[dict[str, Any]] = []

    print(f"Synthesizing {cfg.set_name} ({len(cfg.vot_steps_ms)} steps)...")

    for step_idx, vot_ms in enumerate(cfg.vot_steps_ms, start=1):
        sound = _build_klattgrid(vot_ms, cfg)
        # KlattGrid synthesis is at 44.1 kHz by default in parselmouth.
        samples = sound.values[0].astype(np.float64)
        src_rate = int(sound.sampling_frequency)
        samples = _normalize_loudness(samples)

        filename_stem = f"{cfg.set_id}_step{step_idx:02d}"

        for sr in cfg.sample_rates_hz:
            resampled = _resample(samples, src_rate, sr)
            out_path = set_dir / "wav" / _rate_label(sr) / f"{filename_stem}.wav"
            sf.write(str(out_path), resampled, sr, subtype="PCM_16")

        csv_rows.append({
            "step": step_idx,
            "filename": f"{filename_stem}.wav",
            "vot_ms": vot_ms,
            "f0_start_hz": cfg.f0_start_hz,
            "f0_end_hz": cfg.f0_end_hz,
            "f1_hz": cfg.formants[0].freq,
            "f2_hz": cfg.formants[1].freq,
            "f3_hz": cfg.formants[2].freq if len(cfg.formants) > 2 else "",
            "duration_ms": _total_duration_ms(cfg, vot_ms),
        })

        config_stimuli.append({
            "id": f"step{step_idx:02d}",
            "filename": f"{filename_stem}.wav",
            "continuumStep": step_idx,
            "vot_ms": vot_ms,
        })

        print(f"  step {step_idx:02d}: VOT = {vot_ms:+.0f} ms")

    _write_csv(set_dir / "acoustic_parameters.csv", csv_rows)
    _write_lab_config(set_dir / "perception_lab_config.json", cfg, config_stimuli)
    _write_readme(set_dir / "README.txt", cfg)
    _write_technical_note(set_dir / "TECHNICAL_NOTE.md", cfg, csv_rows)
    _write_license(set_dir / "LICENSE.txt", cfg)

    print(f"\nDone. Package at: {set_dir}")
    print(f"To bundle for sale: zip -r {cfg.set_id}_v1.zip {set_dir}/")


def _rate_label(sr_hz: int) -> str:
    """Convention: 44100 -> '44k1', 22050 -> '22k05', 16000 -> '16k'."""
    whole_khz = sr_hz // 1000
    remainder_hz = sr_hz % 1000
    if remainder_hz == 0:
        return f"{whole_khz}k"
    frac_str = f"{remainder_hz:03d}".rstrip("0")
    return f"{whole_khz}k{frac_str}"


def _total_duration_ms(cfg: Config, vot_ms: float) -> float:
    t = cfg.timing
    closure = max(t.closure_ms, abs(min(vot_ms, 0)) + 20)
    if vot_ms >= 0:
        return t.lead_silence_ms + closure + t.burst_ms + vot_ms + t.vowel_ms + t.trail_silence_ms
    return t.lead_silence_ms + closure + t.burst_ms + t.vowel_ms + t.trail_silence_ms


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def _write_lab_config(path: Path, cfg: Config, stimuli: list[dict[str, Any]]) -> None:
    payload = {
        "version": 1,
        "paradigm": "identification",
        "stimuliBaseUrl": "./wav/44k1/",
        "stimuli": stimuli,
        "responseLabels": _default_response_labels(cfg.contrast),
        "instructions": f"聞こえた音が {cfg.contrast} のどちらかを選んでください。",
        "trialsPerStimulus": 5,
        "practiceTrials": 6,
        "breakEvery": 22,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _default_response_labels(contrast: str) -> list[str]:
    # Try to split "/k/-/g/" or "/p/-/b/" into the two response labels.
    parts = [p.strip("/") for p in contrast.split("-")]
    return parts if len(parts) == 2 else ["A", "B"]


def _write_readme(path: Path, cfg: Config) -> None:
    text = f"""{cfg.set_name}
================================================

ID:        {cfg.set_id}
Steps:     {len(cfg.vot_steps_ms)} ({cfg.vot_steps_ms[0]:+.0f} 〜 {cfg.vot_steps_ms[-1]:+.0f} ms)
Synthesis: Klatt (KlattGrid in Praat, fully synthesized, no source recording)

Files:
  wav/44k1/     44.1 kHz WAV (highest fidelity)
  wav/22k05/    22.05 kHz WAV
  wav/16k/      16 kHz WAV (smaller files for slow connections)
  acoustic_parameters.csv    Per-stimulus parameter table
  perception_lab_config.json Importable Perception Lab config
  TECHNICAL_NOTE.md          Full methods & citation info
  LICENSE.txt                Usage license

Quick start with Perception Lab:
  1. Place this folder where Perception Lab can read the wav/ files.
  2. Open the Perception Lab configuration panel (?config=1).
  3. Import perception_lab_config.json.
  4. Adjust trialsPerStimulus and practiceTrials as needed.

Citation:
  See TECHNICAL_NOTE.md section "Citation".

Support:
  See LICENSE.txt for support contact and validity period.
"""
    path.write_text(text, encoding="utf-8")


def _write_technical_note(path: Path, cfg: Config, rows: list[dict[str, Any]]) -> None:
    rows_md = "\n".join(
        f"| {r['step']} | {r['vot_ms']:+.0f} | {r['f0_start_hz']:.0f} → {r['f0_end_hz']:.0f} | {r['f1_hz']:.0f} | {r['f2_hz']:.0f} | {r['duration_ms']:.0f} |"
        for r in rows
    )
    text = f"""# Technical Note: {cfg.set_name}

## Set Information

| | |
|---|---|
| Set name | {cfg.set_name} |
| Set ID | {cfg.set_id} |
| Version | 1.0 |
| Language | {cfg.language} |
| Contrast | {cfg.contrast} |
| Vowel | /{cfg.vowel}/ |
| Continuum dimension | Voice Onset Time (VOT) |
| Number of steps | {len(cfg.vot_steps_ms)} |
| Range | {cfg.vot_steps_ms[0]:+.0f} ms 〜 {cfg.vot_steps_ms[-1]:+.0f} ms |

## Synthesis Method

完全合成 (Fully synthesized). Praat の KlattGrid (Klatt 1980; Klatt & Klatt 1990) を
用いてゼロから生成されており、既存録音の波形を一切含まない。

合成は parselmouth 経由で KlattGrid を制御し、以下を時間軸上で配置:

- Pitch tier: F0 を {cfg.f0_start_hz:.0f} → {cfg.f0_end_hz:.0f} Hz (linear)
- Voicing amplitude tier: prevoicing (負 VOT 時) → modal voicing
- Oral formants ({len(cfg.formants)} formants): vowel /{cfg.vowel}/ 固定値
- Frication tier: burst transient + aspiration noise (正 VOT 時)

## Parameters

| step | VOT (ms) | F0 (Hz) | F1 (Hz) | F2 (Hz) | duration (ms) |
|---|---|---|---|---|---|
{rows_md}

詳細は acoustic_parameters.csv を参照。

## Recommended Use

- パラダイム: Identification ({" / ".join(_default_response_labels(cfg.contrast))})
- 推奨被験者数: 16-30 名
- 推奨試行: 練習 6 + 本試行 ({len(cfg.vot_steps_ms)} × 5 = {len(cfg.vot_steps_ms) * 5}) ≈ 5-7 分

## Citation

### 日本語（推奨）

> labphonlab (2026). {cfg.set_name} ({cfg.set_id}_v1) [音声刺激]. Perception Lab 刺激音セット.

### English (APA)

> labphonlab. (2026). *{cfg.set_name} ({cfg.set_id}_v1)* [Audio stimuli]. Perception Lab Stimulus Sets.

## References

- Klatt, D. H. (1980). Software for a cascade/parallel formant synthesizer. *Journal of the Acoustical Society of America*, 67(3), 971-995.
- Klatt, D. H., & Klatt, L. C. (1990). Analysis, synthesis, and perception of voice quality variations among female and male talkers. *Journal of the Acoustical Society of America*, 87(2), 820-857.
- Lisker, L., & Abramson, A. S. (1964). A cross-language study of voicing in initial stops. *Word*, 20(3), 384-422.

## License

Perception Lab 共通ライセンス B 章に基づき提供。再配布不可、引用必須。
詳細は LICENSE.txt を参照。
"""
    path.write_text(text, encoding="utf-8")


def _write_license(path: Path, cfg: Config) -> None:
    text = f"""Perception Lab 刺激音セット ライセンス
================================================

セット: {cfg.set_name} ({cfg.set_id})
発行者: labphonlab

このセットは Perception Lab 共通ライセンス B 章に基づき提供されます。

許諾事項:
  - 学術研究での刺激としての利用 (科研費・受託研究を含む)
  - 学会発表・論文での使用 (引用必須)
  - 臨床業務での評価刺激
  - 大学・大学院での教育目的

禁止事項:
  - 第三者への再配布・販売・無償提供
  - SaaS / クラウドサービスとして提供すること
  - 著作権表示の削除

引用義務:
  本セットを用いた研究を発表する際は、TECHNICAL_NOTE.md 記載の
  書誌情報を必ず明記してください。

サポート: support@labphonlab.example (購入後 30 日間)
詳細ライセンス: https://[purchase URL]/LICENSE.md
"""
    path.write_text(text, encoding="utf-8")


# ---------- Entry point ----------

def main() -> int:
    parser = argparse.ArgumentParser(description="Synthesize a VOT continuum stimulus package.")
    parser.add_argument("config", type=Path, help="Path to the YAML config file.")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("output"),
        help="Output root directory (default: ./output).",
    )
    args = parser.parse_args()

    if not args.config.exists():
        print(f"Config not found: {args.config}", file=sys.stderr)
        return 1

    cfg = Config.from_yaml(args.config)
    synthesize_continuum(cfg, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
