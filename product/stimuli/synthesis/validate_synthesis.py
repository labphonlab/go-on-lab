"""
Validate that synthesized VOT continuum stimuli match the spec.

For each WAV in the generated package:
  - Measure actual VOT (burst onset to modal voicing onset)
  - Measure F1, F2, F3 in the middle of the vowel
Compare to the YAML spec, print a per-step table, write a CSV report.

Usage:
    python validate_synthesis.py configs/jpn_kg_vot.yaml
"""

import argparse
import csv
import sys
from pathlib import Path

import numpy as np
import parselmouth
import yaml
from parselmouth.praat import call


def _find_burst_time(sound: parselmouth.Sound, skip_initial_s: float = 0.030) -> float:
    """
    Burst onset by waveform amplitude threshold. After the leading silence,
    the first sample whose absolute amplitude exceeds 5% of the global peak
    marks the burst. Robust to prevoicing (which sits below 5%) and to the
    intensity-envelope smoothing lag.
    """
    samples = np.array(sound.values[0])
    sr = int(sound.sampling_frequency)
    skip_n = int(skip_initial_s * sr)
    peak = float(np.max(np.abs(samples)))
    thresh = 0.05 * peak
    above = np.where(np.abs(samples[skip_n:]) > thresh)[0]
    if len(above) == 0:
        return float("nan")
    return float((skip_n + above[0]) / sr)


def _find_voicing_onset(sound: parselmouth.Sound, f0_floor: float = 50.0) -> float:
    """
    Voicing onset via Praat's autocorrelation pitch tracker. Permissive floor
    so prevoicing is also caught. Returns time of first frame with F0 > floor.
    """
    pitch = sound.to_pitch_ac(
        time_step=0.005,
        pitch_floor=f0_floor,
        pitch_ceiling=400.0,
        very_accurate=True,
    )
    f0s = pitch.selected_array["frequency"]
    times = pitch.xs()
    voiced = np.where(f0s > f0_floor)[0]
    if len(voiced) == 0:
        return float("nan")
    return float(times[voiced[0]])


def _measure_formants_in_window(
    sound: parselmouth.Sound,
    window_start_s: float,
    window_end_s: float,
) -> dict[str, float]:
    """Mean F1/F2/F3 from Burg LPC formant tracking over [start, end]."""
    # 4-formant LPC is more reliable for /a/ than 5-formant: the 5th pole
    # tends to split F2 into a spurious doublet for this synthesis.
    formants = sound.to_formant_burg(
        time_step=0.005,
        max_number_of_formants=4,
        maximum_formant=4500.0,
        window_length=0.025,
    )
    samples = {1: [], 2: [], 3: []}
    t = window_start_s
    while t <= window_end_s:
        for fn in (1, 2, 3):
            v = formants.get_value_at_time(formant_number=fn, time=t)
            if v is not None and not np.isnan(v):
                samples[fn].append(v)
        t += 0.005
    return {
        f"f{fn}": (float(np.mean(samples[fn])) if samples[fn] else float("nan"))
        for fn in (1, 2, 3)
    }


def validate(config_path: Path, output_dir: Path) -> int:
    with config_path.open(encoding="utf-8") as fp:
        cfg = yaml.safe_load(fp)

    set_id = cfg["set_id"]
    spec_vots = list(cfg["vot_steps_ms"])
    spec_f = {
        "f1": cfg["formants"]["f1"]["freq"],
        "f2": cfg["formants"]["f2"]["freq"],
        "f3": cfg["formants"]["f3"]["freq"],
    }
    vowel_dur_s = cfg["timing"]["vowel"] / 1000.0

    set_dir = output_dir / set_id
    wav_dir = set_dir / "wav" / "44k1"
    if not wav_dir.exists():
        print(f"WAV directory not found: {wav_dir}", file=sys.stderr)
        print("Run synthesize_vot_continuum.py first.", file=sys.stderr)
        return 1

    print(f"Validating: {cfg['set_name']} ({set_id})")
    print(f"Spec formants: F1={spec_f['f1']:.0f} F2={spec_f['f2']:.0f} F3={spec_f['f3']:.0f} Hz")
    print()
    header = (
        f"{'step':>4} {'spec_VOT':>9} {'meas_VOT':>9} {'err':>7}   "
        f"{'meas_F1':>8} {'F1_err':>7}   "
        f"{'meas_F2':>8} {'F2_err':>7}   "
        f"{'meas_F3':>8} {'F3_err':>7}"
    )
    print(header)
    print("-" * len(header))

    rows: list[dict] = []
    for step_idx, spec_vot in enumerate(spec_vots, start=1):
        wav_path = wav_dir / f"{set_id}_step{step_idx:02d}.wav"
        sound = parselmouth.Sound(str(wav_path))

        burst_s = _find_burst_time(sound)
        voicing_onset_s = _find_voicing_onset(sound)
        meas_vot_ms = (voicing_onset_s - burst_s) * 1000.0 if not np.isnan(voicing_onset_s) else float("nan")

        # Measure formants in the steady vowel region: take the middle 60%
        # of the post-burst voiced vowel. For negative VOT, voicing started
        # before burst, but the modal vowel still begins at the burst.
        modal_vowel_start_s = burst_s + max(0.0, spec_vot / 1000.0)
        # Avoid the first 30 ms (onset transients) and the last 30 ms.
        win_start = modal_vowel_start_s + 0.030
        win_end = modal_vowel_start_s + vowel_dur_s - 0.030
        formants = _measure_formants_in_window(sound, win_start, win_end)

        row = {
            "step": step_idx,
            "spec_vot_ms": spec_vot,
            "meas_vot_ms": meas_vot_ms,
            "vot_error_ms": meas_vot_ms - spec_vot,
            "burst_time_ms": burst_s * 1000,
            "voicing_onset_ms": voicing_onset_s * 1000,
            "spec_f1_hz": spec_f["f1"],
            "meas_f1_hz": formants["f1"],
            "spec_f2_hz": spec_f["f2"],
            "meas_f2_hz": formants["f2"],
            "spec_f3_hz": spec_f["f3"],
            "meas_f3_hz": formants["f3"],
        }
        rows.append(row)

        def fmt(v, fmt_str):
            return fmt_str.format(v) if not np.isnan(v) else "    NaN"

        print(
            f"{step_idx:>4} "
            f"{spec_vot:>+9.0f} "
            f"{fmt(meas_vot_ms, '{:>+9.1f}')} "
            f"{fmt(meas_vot_ms - spec_vot, '{:>+7.1f}')}   "
            f"{fmt(formants['f1'], '{:>8.0f}')} "
            f"{fmt(formants['f1'] - spec_f['f1'], '{:>+7.0f}')}   "
            f"{fmt(formants['f2'], '{:>8.0f}')} "
            f"{fmt(formants['f2'] - spec_f['f2'], '{:>+7.0f}')}   "
            f"{fmt(formants['f3'], '{:>8.0f}')} "
            f"{fmt(formants['f3'] - spec_f['f3'], '{:>+7.0f}')}"
        )

    # Summary stats.
    vot_errs = np.array([r["vot_error_ms"] for r in rows if not np.isnan(r["vot_error_ms"])])
    f1_errs = np.array([r["meas_f1_hz"] - r["spec_f1_hz"] for r in rows if not np.isnan(r["meas_f1_hz"])])
    f2_errs = np.array([r["meas_f2_hz"] - r["spec_f2_hz"] for r in rows if not np.isnan(r["meas_f2_hz"])])
    f3_errs = np.array([r["meas_f3_hz"] - r["spec_f3_hz"] for r in rows if not np.isnan(r["meas_f3_hz"])])

    print()
    print("Summary (measured - spec):")
    print(f"  VOT: mean error = {vot_errs.mean():+.2f} ms, std = {vot_errs.std():.2f} ms")
    print(f"  F1:  mean error = {f1_errs.mean():+.1f} Hz, std = {f1_errs.std():.1f} Hz")
    print(f"  F2:  mean error = {f2_errs.mean():+.1f} Hz, std = {f2_errs.std():.1f} Hz")
    print(f"  F3:  mean error = {f3_errs.mean():+.1f} Hz, std = {f3_errs.std():.1f} Hz")

    # Verdict.
    print()
    issues = []
    if abs(vot_errs.mean()) > 5 or vot_errs.std() > 3:
        issues.append(f"VOT error mean/std exceeds 5/3 ms; review burst & voicing timing")
    if abs(f1_errs.mean()) > 50:
        issues.append(f"F1 mean error exceeds 50 Hz; review oral formant 1 setting")
    if abs(f2_errs.mean()) > 50:
        issues.append(f"F2 mean error exceeds 50 Hz; review oral formant 2 setting")

    if issues:
        print("ISSUES DETECTED:")
        for i in issues:
            print(f"  - {i}")
    else:
        print("All measurements within tolerance.")

    # Write CSV.
    report_path = set_dir / "validation_report.csv"
    with report_path.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nReport written: {report_path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate synthesized VOT continuum.")
    parser.add_argument("config", type=Path)
    parser.add_argument("--out", type=Path, default=Path("output"))
    args = parser.parse_args()
    if not args.config.exists():
        print(f"Config not found: {args.config}", file=sys.stderr)
        return 1
    return validate(args.config, args.out)


if __name__ == "__main__":
    sys.exit(main())
