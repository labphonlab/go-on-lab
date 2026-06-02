# Praat-only VOT continuum synthesizer.
#
# Run from Praat: Open → Praat Objects → Praat → Open Praat script... → this file → Run.
#
# Outputs N WAV files (44.1 kHz only) into the directory specified by `out_dir`.
# For the full pipeline (3 sample rates, CSV, config JSON, README, license),
# use synthesize_vot_continuum.py.
#
# Edit the form below to switch contrasts (e.g. /k/-/g/ vs /t/-/d/).

form Synthesize VOT continuum
  comment ----- Output -----
  sentence Set_id jpn_kg_vot
  sentence Out_dir /tmp/perception_lab_stimuli
  comment ----- VOT range -----
  real Vot_min_ms -40
  real Vot_max_ms 60
  integer Steps 11
  comment ----- Vowel formants (Hz) -----
  real F1 700
  real F2 1200
  real F3 2600
  real F1_bw 90
  real F2_bw 110
  real F3_bw 170
  comment ----- F0 (Hz) -----
  real F0_start 130
  real F0_end 100
  comment ----- Timing (ms) -----
  real Lead_silence_ms 50
  real Closure_ms 60
  real Burst_ms 5
  real Vowel_ms 200
  real Trail_silence_ms 50
  comment ----- Amplitudes (dB) -----
  real Voicing_db 72
  real Prevoicing_db 55
  real Burst_db 68
  real Aspiration_db 58
  comment ----- Burst place (velar / dental / labial) -----
  sentence Burst_type velar
endform

# Make output directory.
createDirectory: out_dir$

# Compute step values.
step_size = (vot_max_ms - vot_min_ms) / (steps - 1)

for step from 1 to steps
  vot_ms = vot_min_ms + (step - 1) * step_size
  vot_s = vot_ms / 1000

  # Adjust closure to fit prevoicing if needed.
  closure_s = closure_ms / 1000
  if vot_s < 0 and abs(vot_s) + 0.020 > closure_s
    closure_s = abs(vot_s) + 0.020
  endif

  lead_s = lead_silence_ms / 1000
  burst_s = burst_ms / 1000
  vowel_s = vowel_ms / 1000
  trail_s = trail_silence_ms / 1000

  t_closure_start = lead_s
  t_burst = t_closure_start + closure_s
  t_voicing_onset = t_burst + vot_s
  t_vowel_end = max(t_burst, t_voicing_onset) + vowel_s
  t_end = t_vowel_end + trail_s

  # Frication formants by place of articulation.
  if burst_type$ = "labial"
    frf1 = 500
    frf2 = 1500
    frf3 = 3000
    frf1bw = 300
    frf2bw = 400
    frf3bw = 500
  elsif burst_type$ = "dental"
    frf1 = 2500
    frf2 = 4000
    frf3 = 6000
    frf1bw = 300
    frf2bw = 500
    frf3bw = 700
  else
    # velar (default)
    frf1 = 1800
    frf2 = 2500
    frf3 = 4000
    frf1bw = 300
    frf2bw = 400
    frf3bw = 600
  endif

  # Create KlattGrid.
  Create KlattGrid: "vot_token", 0, t_end, 4, 0, 0, 3, 0, 0, 0

  # Pitch.
  Add pitch point: max(0, t_voicing_onset - 0.005), f0_start
  Add pitch point: t_vowel_end, f0_end

  # Voicing amplitude envelope.
  Add voicing amplitude point: 0, 0
  if t_voicing_onset > 0.001
    Add voicing amplitude point: t_voicing_onset - 0.001, 0
  endif
  if vot_s < 0
    Add voicing amplitude point: t_voicing_onset, prevoicing_db
    Add voicing amplitude point: t_burst, prevoicing_db
    Add voicing amplitude point: t_burst + 0.005, voicing_db
  else
    Add voicing amplitude point: t_voicing_onset, voicing_db
  endif
  Add voicing amplitude point: t_vowel_end, voicing_db
  Add voicing amplitude point: t_vowel_end + 0.001, 0

  # Oral formants.
  t_anchor = max(0, t_burst - 0.050)
  Add oral formant frequency point: 1, t_anchor, f1
  Add oral formant frequency point: 1, t_vowel_end, f1
  Add oral formant bandwidth point: 1, t_anchor, f1_bw
  Add oral formant bandwidth point: 1, t_vowel_end, f1_bw
  Add oral formant frequency point: 2, t_anchor, f2
  Add oral formant frequency point: 2, t_vowel_end, f2
  Add oral formant bandwidth point: 2, t_anchor, f2_bw
  Add oral formant bandwidth point: 2, t_vowel_end, f2_bw
  Add oral formant frequency point: 3, t_anchor, f3
  Add oral formant frequency point: 3, t_vowel_end, f3
  Add oral formant bandwidth point: 3, t_anchor, f3_bw
  Add oral formant bandwidth point: 3, t_vowel_end, f3_bw
  Add oral formant frequency point: 4, t_anchor, 3500
  Add oral formant frequency point: 4, t_vowel_end, 3500
  Add oral formant bandwidth point: 4, t_anchor, 250
  Add oral formant bandwidth point: 4, t_vowel_end, 250

  # Frication formants (per-formant amplitude must be set or the source
  # passes through with zero gain).
  Add frication formant frequency point: 1, t_burst, frf1
  Add frication formant bandwidth point: 1, t_burst, frf1bw
  Add frication formant amplitude point: 1, t_burst, 30
  Add frication formant frequency point: 2, t_burst, frf2
  Add frication formant bandwidth point: 2, t_burst, frf2bw
  Add frication formant amplitude point: 2, t_burst, 30
  Add frication formant frequency point: 3, t_burst, frf3
  Add frication formant bandwidth point: 3, t_burst, frf3bw
  Add frication formant amplitude point: 3, t_burst, 30

  # Burst envelope on the frication source.
  Add frication amplitude point: max(0, t_burst - 0.002), 0
  Add frication amplitude point: t_burst, burst_db
  Add frication amplitude point: t_burst + burst_s, burst_db - 10
  Add frication amplitude point: t_burst + burst_s + 0.001, 0

  # Aspiration via cascade (vowel-shaped) for positive VOT.
  if vot_s > 0
    asp_start = t_burst + burst_s
    asp_end = max(asp_start + 0.003, t_voicing_onset - 0.003)
    Add aspiration amplitude point: asp_start - 0.001, 0
    Add aspiration amplitude point: asp_start + 0.001, aspiration_db
    Add aspiration amplitude point: asp_end, aspiration_db
    Add aspiration amplitude point: t_voicing_onset, 0
  endif

  # Synthesize, normalize, save.
  To Sound
  Scale peak: 0.95

  step_str$ = "'step'"
  if step < 10
    step_str$ = "0'step'"
  endif
  out_path$ = out_dir$ + "/" + set_id$ + "_step" + step_str$ + ".wav"
  Save as WAV file: out_path$

  appendInfoLine: "step ", step_str$, ": VOT = ", fixed$(vot_ms, 0), " ms -> ", out_path$

  # Cleanup objects for this iteration.
  selectObject: "KlattGrid vot_token"
  plusObject: "Sound vot_token"
  Remove
endfor

appendInfoLine: ""
appendInfoLine: "Done. ", steps, " WAV files in: ", out_dir$
